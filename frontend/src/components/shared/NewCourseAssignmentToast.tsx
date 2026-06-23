import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useTrainerModeStore } from "../../store/trainerModeStore";
import { coursesService } from "../../services/coursesService";
import type { CourseListItem } from "../../types/course";

const SEEN_KEY = "trainer_seen_enrollment_ids";
const INIT_KEY = "trainer_enrollments_initialized";
const POLL_MS = 60_000;

function getSeenIds(): Set<number> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set<number>(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set();
  }
}

function markAllSeen(ids: number[]) {
  const seen = getSeenIds();
  ids.forEach((id) => seen.add(id));
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
}

export function NewCourseAssignmentToast() {
  const { user } = useAuthStore();
  const { mode, setMode } = useTrainerModeStore();
  const navigate = useNavigate();
  const [pending, setPending] = useState<CourseListItem | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const shouldPoll = user?.role === "TRAINER" && mode === "INSTRUCTOR";

  async function checkAssignments() {
    try {
      const res = await coursesService.getMyEnrolledCourses();
      const courses = res.results;

      const initialized = localStorage.getItem(INIT_KEY) === "true";
      if (!initialized) {
        markAllSeen(courses.map((c) => c.id));
        localStorage.setItem(INIT_KEY, "true");
        return;
      }

      const seen = getSeenIds();
      const newCourse = courses.find((c) => !seen.has(c.id));
      if (newCourse && !pending) {
        setPending(newCourse);
        setVisible(true);
      }
    } catch {
      // silent — toast failure must never crash the app
    }
  }

  useEffect(() => {
    if (!shouldPoll) {
      if (timerRef.current) clearInterval(timerRef.current);
      setVisible(false);
      return;
    }
    void checkAssignments();
    timerRef.current = setInterval(() => void checkAssignments(), POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPoll]);

  function dismiss() {
    if (pending) markAllSeen([pending.id]);
    setVisible(false);
    setTimeout(() => setPending(null), 300);
  }

  function switchToAlumno() {
    if (pending) markAllSeen([pending.id]);
    setMode("ALUMNO");
    navigate("/courses");
    setVisible(false);
    setTimeout(() => setPending(null), 300);
  }

  if (!pending) return null;

  const deadline = pending.fecha_limite
    ? new Date(pending.fecha_limite).toLocaleDateString("es-EC", {
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 9999,
        width: 296,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-10px)",
        transition: "opacity 0.3s ease, transform 0.3s ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {/* Franja degradada índigo→verde */}
      <div
        style={{
          height: 3,
          background: "linear-gradient(90deg, #6366f1, #34d399)",
          borderRadius: "12px 12px 0 0",
        }}
      />

      <div
        style={{
          background: "#1a2332",
          border: "1px solid rgba(99,102,241,0.4)",
          borderTop: "none",
          borderRadius: "0 0 12px 12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
          padding: "11px 13px 13px",
        }}
      >
        {/* Cabecera */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 9 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: "rgba(52,211,153,0.12)",
                border: "1px solid rgba(52,211,153,0.25)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <i className="ti ti-books" style={{ color: "#34D399", fontSize: 16 }} aria-hidden="true" />
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.9)", margin: 0, lineHeight: 1.3 }}>
                Te han inscrito en un curso
              </p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.32)", margin: 0 }}>
                Como alumno · ahora mismo
              </p>
            </div>
          </div>
          <button
            onClick={dismiss}
            style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 13, cursor: "pointer", padding: 0, lineHeight: 1, flexShrink: 0 }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Tarjeta del curso */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 8,
            padding: "8px 10px",
            marginBottom: 11,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.85)", margin: "0 0 5px", lineHeight: 1.3 }}>
            {pending.titulo}
          </p>
          <div style={{ display: "flex", gap: 14 }}>
            {pending.duracion_horas != null && (
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.32)", display: "flex", alignItems: "center", gap: 3 }}>
                <i className="ti ti-clock" style={{ fontSize: 11 }} aria-hidden="true" />
                {pending.duracion_horas}h
              </span>
            )}
            {deadline && (
              <span style={{ fontSize: 10, color: "#F59E0B", display: "flex", alignItems: "center", gap: 3 }}>
                <i className="ti ti-calendar" style={{ fontSize: 11 }} aria-hidden="true" />
                Vence {deadline}
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={switchToAlumno}
            style={{
              background: "#4F46E5",
              color: "white",
              border: "none",
              borderRadius: 7,
              fontSize: 11,
              fontWeight: 500,
              padding: "6px 11px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <i className="ti ti-arrows-exchange" style={{ fontSize: 12 }} aria-hidden="true" />
            Ir a modo alumno
          </button>
          <button
            onClick={dismiss}
            style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 11, padding: "6px 8px", cursor: "pointer" }}
          >
            Después
          </button>
        </div>
      </div>
    </div>
  );
}
