import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import type { Role } from "../types";

interface ProtectedRouteProps {
  /** Allowed roles. If omitted, any authenticated user is allowed. */
  allowedRoles?: Role[];
}

/**
 * Redirects unauthenticated users to /login (preserving the intended URL).
 * Redirects authenticated users with wrong roles to /403.
 * Redirects authenticated users who must change their password to /change-password.
 */
export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Force password change intercept (T05 spec)
  if (
    user?.must_change_password &&
    !location.pathname.startsWith("/change-password")
  ) {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
