import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAuthStore } from "./store/authStore";
import { AppRouter } from "./router";
import { SessionExpiredModal } from "./components/shared/SessionExpiredModal";

function AppInner() {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  // Restore session once on app mount: reads stored token → calls /me/
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return <AppRouter />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppInner />
        {/* Global toast — available on every page including login */}
        <Toaster position="top-right" richColors closeButton />
        {/* P05 — fires when Axios refresh interceptor can't renew tokens */}
        <SessionExpiredModal />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
