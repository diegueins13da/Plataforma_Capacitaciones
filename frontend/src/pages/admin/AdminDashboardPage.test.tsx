/**
 * Tests for AdminDashboardPage (P25)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminDashboardPage from "./AdminDashboardPage";
import { usersService } from "../../services/usersService";
import type { Group } from "../../types/groups";

vi.mock("../../services/usersService");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockGroups: Group[] = [
  { id: 1, nombre: "TI", descripcion: "", activo: true, created_at: "", cursos_activos: 0, member_count: 0 },
  { id: 2, nombre: "RRHH", descripcion: "", activo: true, created_at: "", cursos_activos: 0, member_count: 0 },
];

function mockPaginatedResponse(count: number) {
  return { count, next: null, previous: null, results: [] };
}

function renderPage() {
  render(
    <MemoryRouter>
      <AdminDashboardPage />
    </MemoryRouter>
  );
}

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersService.getUsers).mockImplementation(async (filters) => {
      if (filters?.role === "ADMIN") return mockPaginatedResponse(2);
      if (filters?.role === "TRAINER") return mockPaginatedResponse(3);
      if (filters?.is_active === true) return mockPaginatedResponse(18);
      return mockPaginatedResponse(20);
    });
    vi.mocked(usersService.getGroups).mockResolvedValue(mockGroups);
  });

  it("shows loading state initially", () => {
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(/cargando/i);
  });

  it("renders page title", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /panel de administración/i })).toBeInTheDocument();
  });

  it("renders stat cards after loading", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Usuarios totales")).toBeInTheDocument();
    });
    expect(screen.getByText("Usuarios activos")).toBeInTheDocument();
    expect(screen.getByText("Administradores")).toBeInTheDocument();
    expect(screen.getByText("Capacitadores")).toBeInTheDocument();
    // "Grupos" appears in both the stat card and the shortcut link — use getAllByText
    expect(screen.getAllByText("Grupos").length).toBeGreaterThanOrEqual(1);
  });

  it("shows correct stats from API responses", async () => {
    renderPage();
    await waitFor(() => {
      // 20 total users
      expect(screen.getByText("20")).toBeInTheDocument();
    });
    // 18 active
    expect(screen.getByText("18")).toBeInTheDocument();
    // "2" appears for adminCount (2) AND groups (2)
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(2);
    // 3 trainers
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders shortcut links to main admin sections", async () => {
    renderPage();
    await waitFor(() => {
      // At least one link exists (stat loading done)
      expect(screen.getAllByRole("link").length).toBeGreaterThan(0);
    });
    const hrefs = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/admin/users");
    expect(hrefs).toContain("/admin/groups");
    expect(hrefs).toContain("/admin/courses");
    expect(hrefs).toContain("/admin/reports");
  });

  it("shortcut links point to correct routes", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByRole("link").length).toBeGreaterThan(0);
    });
    const links = screen.getAllByRole("link");
    const byHref = (href: string) => links.find((l) => l.getAttribute("href") === href);
    expect(byHref("/admin/users")).toBeInTheDocument();
    expect(byHref("/admin/groups")).toBeInTheDocument();
    expect(byHref("/admin/courses")).toBeInTheDocument();
    expect(byHref("/admin/reports")).toBeInTheDocument();
  });

  it("shows placeholder dashes for future stats (courses, certs)", async () => {
    renderPage();
    await waitFor(() => {
      // Multiple "–" for courses/assessments/certificates
      const dashes = screen.getAllByText("–");
      expect(dashes.length).toBeGreaterThanOrEqual(3);
    });
  });

  it("shows error toast when stats loading fails", async () => {
    const { toast } = await import("sonner");
    vi.mocked(usersService.getUsers).mockRejectedValue(new Error("network"));
    renderPage();
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "No se pudieron cargar las estadísticas del panel."
      );
    });
  });
});
