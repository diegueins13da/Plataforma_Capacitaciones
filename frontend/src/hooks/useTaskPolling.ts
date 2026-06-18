import { useCallback, useEffect, useRef, useState } from "react";
import { aiService, type TaskStatus } from "../services/aiService";

type PollingStatus = "idle" | "polling" | "success" | "error";

export interface UseTaskPollingResult {
  status: PollingStatus;
  taskStatus: TaskStatus | null;
  startPolling: (taskId: string) => void;
  reset: () => void;
}

const POLL_INTERVAL_MS = 3000;

export function useTaskPolling(): UseTaskPollingResult {
  const [status, setStatus] = useState<PollingStatus>("idle");
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const taskIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (taskId: string) => {
      stopPolling();
      taskIdRef.current = taskId;
      setStatus("polling");
      setTaskStatus(null);

      const poll = async () => {
        if (!taskIdRef.current) return;
        try {
          const result = await aiService.getTaskStatus(taskIdRef.current);
          setTaskStatus(result);
          if (result.status === "SUCCESS") {
            stopPolling();
            setStatus("success");
          } else if (result.status === "FAILURE") {
            stopPolling();
            setStatus("error");
          }
        } catch {
          stopPolling();
          setStatus("error");
        }
      };

      void poll(); // immediate first check
      intervalRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  const reset = useCallback(() => {
    stopPolling();
    taskIdRef.current = null;
    setStatus("idle");
    setTaskStatus(null);
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return stopPolling;
  }, [stopPolling]);

  return { status, taskStatus, startPolling, reset };
}
