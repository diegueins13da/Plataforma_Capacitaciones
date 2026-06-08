import { Outlet } from "react-router-dom";

/**
 * Authenticated-area shell layout.
 * Sidebar and header implemented in T35.
 */
export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — T35 */}
      <main className="flex-1 overflow-y-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}
