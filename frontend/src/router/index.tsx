import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppLayout } from "../components/layout/AppLayout";

// Lazy-loaded pages
const LoginPage = lazy(() => import("../pages/auth/LoginPage"));
const PasswordRecoveryPage = lazy(() => import("../pages/auth/PasswordRecoveryPage"));
const AccountLockedPage = lazy(() => import("../pages/auth/AccountLockedPage"));
const ForceChangePasswordPage = lazy(() => import("../pages/auth/ForceChangePasswordPage"));
const DashboardPage = lazy(() => import("../pages/dashboard/DashboardPage"));
const ProfilePage = lazy(() => import("../pages/dashboard/ProfilePage"));
const AdminDashboardPage = lazy(() => import("../pages/admin/AdminDashboardPage"));
const UserManagementPage = lazy(() => import("../pages/admin/users/UserManagementPage"));
const GroupManagementPage = lazy(() => import("../pages/admin/users/GroupManagementPage"));
const AdminCoursesPage = lazy(() => import("../pages/admin/courses/AdminCoursesPage"));
const AdminReportsPage = lazy(() => import("../pages/admin/reports/AdminReportsPage"));
const NotFoundPage = lazy(() => import("../pages/errors/NotFoundPage"));
const ForbiddenPage = lazy(() => import("../pages/errors/ForbiddenPage"));
const ServerErrorPage = lazy(() => import("../pages/errors/ServerErrorPage"));

const Loading = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

export function AppRouter() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/password-recovery" element={<PasswordRecoveryPage />} />
        <Route path="/account-locked" element={<AccountLockedPage />} />

        {/* Authenticated — any role — with sidebar layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/change-password" element={<ForceChangePasswordPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* Authenticated — ADMIN only */}
        <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
          <Route element={<AppLayout />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<UserManagementPage />} />
            <Route path="/admin/groups" element={<GroupManagementPage />} />
            <Route path="/admin/courses" element={<AdminCoursesPage />} />
            <Route path="/admin/reports" element={<AdminReportsPage />} />
          </Route>
        </Route>

        {/* Error pages */}
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/500" element={<ServerErrorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
