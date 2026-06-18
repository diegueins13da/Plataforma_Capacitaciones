import { useEffect, useRef, useState } from "react";

export interface UseExamTimerResult {
  secondsLeft: number | null;
  isAlmostExpired: boolean;
  formattedTime: string | null;
}

/**
 * Countdown timer for timed exams.
 * `initialSecondsLeft` should already account for time elapsed since exam start
 * (compute it as: tiempoLimite * 60 - secondsSinceStart).
 * Calls `onExpire` once when the countdown reaches 0.
 */
export function useExamTimer(
  initialSecondsLeft: number | null,
  onExpire: () => void
): UseExamTimerResult {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(initialSecondsLeft);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (initialSecondsLeft === null || initialSecondsLeft <= 0) {
      if (initialSecondsLeft !== null && initialSecondsLeft <= 0) {
        onExpireRef.current();
      }
      return;
    }

    const endTime = Date.now() + initialSecondsLeft * 1000;

    const tick = setInterval(() => {
      const remaining = Math.round((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        setSecondsLeft(0);
        clearInterval(tick);
        onExpireRef.current();
      } else {
        setSecondsLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAlmostExpired = secondsLeft !== null && secondsLeft < 5 * 60;
  const formattedTime = secondsLeft !== null ? formatSeconds(secondsLeft) : null;

  return { secondsLeft, isAlmostExpired, formattedTime };
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
