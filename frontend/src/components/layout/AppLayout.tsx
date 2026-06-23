import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { NewCourseAssignmentToast } from "../shared/NewCourseAssignmentToast";

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto px-10 py-6">
          <Outlet />
        </main>
      </div>
      {/* Floating toast — renders above everything, only active for TRAINER in INSTRUCTOR mode */}
      <NewCourseAssignmentToast />
    </div>
  );
}
