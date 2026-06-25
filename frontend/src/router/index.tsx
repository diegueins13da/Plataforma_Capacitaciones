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
const AdminConfigPage = lazy(() => import("../pages/admin/config/AdminConfigPage"));
const UserManagementPage = lazy(() => import("../pages/admin/users/UserManagementPage"));
const GroupManagementPage = lazy(() => import("../pages/admin/users/GroupManagementPage"));
const BulkImportPage = lazy(() => import("../pages/admin/users/BulkImportPage"));
const ImportHistoryPage = lazy(() => import("../pages/admin/users/ImportHistoryPage"));
const SystemConfigPage = lazy(() => import("../pages/admin/config/SystemConfigPage"));
const CourseListPage = lazy(() => import("../pages/admin/courses/CourseListPage"));
const CourseWizardPage = lazy(() => import("../pages/admin/courses/CourseWizardPage"));
const CourseCatalogPage = lazy(() => import("../pages/courses/CourseCatalogPage"));
const CourseDetailPage = lazy(() => import("../pages/courses/CourseDetailPage"));
const MyCourseListPage = lazy(() => import("../pages/courses/MyCourseListPage"));
const ModulePlayerPage = lazy(() => import("../pages/courses/ModulePlayerPage"));
const CourseCompletedPage = lazy(() => import("../pages/courses/CourseCompletedPage"));
const ExamIntroPage = lazy(() => import("../pages/assessments/ExamIntroPage"));
const ExamQuestionPage = lazy(() => import("../pages/assessments/ExamQuestionPage"));
const ExamResultPage = lazy(() => import("../pages/assessments/ExamResultPage"));
const AIGeneratorPage = lazy(() => import("../pages/admin/courses/AIGeneratorPage"));
const InstructorGradesPage = lazy(() => import("../pages/instructor/InstructorGradesPage"));
const NotificationsPage = lazy(() => import("../pages/dashboard/NotificationsPage"));
const AdminReportsPage = lazy(() => import("../pages/admin/reports/AdminReportsPage"));
const MyCertificatesPage = lazy(() => import("../pages/certificates/MyCertificatesPage"));
const AdminCertificatesPage = lazy(() => import("../pages/certificates/AdminCertificatesPage"));
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
            <Route path="/courses" element={<CourseCatalogPage />} />
            <Route path="/courses/:id" element={<CourseDetailPage />} />
            <Route path="/courses/:courseId/modules/:moduleId" element={<ModulePlayerPage />} />
            <Route path="/courses/:courseId/completed" element={<CourseCompletedPage />} />
            <Route path="/my-courses" element={<Navigate to="/courses" replace />} />
            <Route path="/my-certificates" element={<MyCertificatesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/courses/:courseId/exam" element={<ExamIntroPage />} />
            <Route path="/courses/:courseId/exam/in-progress" element={<ExamQuestionPage />} />
            <Route path="/courses/:courseId/exam/result" element={<ExamResultPage />} />
          </Route>
        </Route>

        {/* ADMIN + TRAINER — course management */}
        <Route element={<ProtectedRoute allowedRoles={["ADMIN", "TRAINER"]} />}>
          <Route element={<AppLayout />}>
            <Route path="/admin/courses" element={<CourseListPage />} />
            <Route path="/admin/courses/new" element={<CourseWizardPage />} />
            <Route path="/admin/courses/:id/edit" element={<CourseWizardPage />} />
            <Route path="/admin/courses/:id/ai-generator" element={<AIGeneratorPage />} />
            <Route path="/instructor/grades" element={<InstructorGradesPage />} />
          </Route>
        </Route>

        {/* ADMIN only */}
        <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
          <Route element={<AppLayout />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/config" element={<AdminConfigPage />} />
            <Route path="/admin/certificates" element={<AdminCertificatesPage />} />
            {/* Legacy — still reachable by direct URL */}
            <Route path="/admin/users" element={<UserManagementPage />} />
            <Route path="/admin/groups" element={<GroupManagementPage />} />
            <Route path="/admin/users/import" element={<BulkImportPage />} />
            <Route path="/admin/users/import-history" element={<ImportHistoryPage />} />
            <Route path="/admin/config/general" element={<SystemConfigPage />} />
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
