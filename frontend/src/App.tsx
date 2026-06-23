import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAuthStore } from "./store/authStore";
import { AppRouter } from "./router";
import { SessionExpiredModal } from "./components/shared/SessionExpiredModal";
import { BrandingProvider } from "./context/BrandingContext";
import { ThemeProvider } from "./context/ThemeContext";

function AppInner() {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return <AppRouter />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <BrandingProvider>
            <AppInner />
            <Toaster position="top-right" richColors closeButton />
            <SessionExpiredModal />
          </BrandingProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
