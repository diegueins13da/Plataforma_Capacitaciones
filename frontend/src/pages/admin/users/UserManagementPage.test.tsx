/**
 * Tests for UserManagementPage (P26)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UserManagementPage from "./UserManagementPage";
import { usersService } from "../../../services/usersService";
import type { AdminUser } from "../../../types/user";
import type { Group } from "../../../types/groups";

vi.mock("../../../services/usersService");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));
// CreateUserModal is used internally; keep it shallow with a stub
vi.mock("../../../components/shared/CreateUserModal", () => ({
  CreateUserModal: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Crear nuevo usuario">
      <button onClick={onClose}>Cerrar modal</button>
    </div>
  ),
}));

const mockUsers: AdminUser[] = [
  {
    id: 1,
    email: "admin@test.com",
    first_name: "Luis",
    last_name: "García",
    full_name: "Luis García",
    role: "ADMIN",
    is_active: true,
    must_change_password: false,
    area: "TI",
    cargo: "CTO",
    grupo_nombre: null,
  },
  {
    id: 2,
    email: "user@test.com",
    first_name: "María",
    last_name: "López",
    full_name: "María López",
    role: "USUARIO",
    is_active: false,
    must_change_password: true,
    area: "",
    cargo: "",
    grupo_nombre: "TI",
  },
];

const mockGroups: Group[] = [
  { id: 1, nombre: "TI", descripcion: "", activo: true, created_at: "", cursos_activos: 0, member_count: 0 },
];

function renderPage() {
  render(
    <MemoryRouter>
      <UserManagementPage />
    </MemoryRouter>
  );
}

describe("UserManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersService.getUsers).mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      results: mockUsers,
    });
    vi.mocked(usersService.getGroups).mockResolvedValue(mockGroups);
  });

  it("shows loading state initially", () => {
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(/cargando/i);
  });

  it("renders the user table after loading", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Luis García")).toBeInTheDocument();
    });
    expect(screen.getByText("María López")).toBeInTheDocument();
  });

  it("shows total user count in header", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/2 usuarios/i)).toBeInTheDocument();
    });
  });

  it("shows active badge for active users and inactive for inactive users", async () => {
    renderPage();
    await waitFor(() => {
      const badges = screen.getAllByText(/activo|inactivo/i);
      expect(badges.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders Desactivar button only for active users", async () => {
    renderPage();
    await waitFor(() => {
      // Luis is active → should have a Desactivar button
      expect(screen.getByLabelText(/desactivar Luis García/i)).toBeInTheDocument();
      // María is inactive → no button for her
      expect(screen.queryByLabelText(/desactivar María López/i)).not.toBeInTheDocument();
    });
  });

  it("renders role select for each user", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/cambiar rol de Luis García/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/cambiar rol de María López/i)).toBeInTheDocument();
    });
  });

  it("opens CreateUserModal when 'Nuevo Usuario' is clicked", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Luis García")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /nuevo usuario/i }));
    expect(screen.getByRole("dialog", { name: /crear nuevo usuario/i })).toBeInTheDocument();
  });

  it("closes the modal when onClose is called", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Luis García")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /nuevo usuario/i }));
    fireEvent.click(screen.getByRole("button", { name: /cerrar modal/i }));
    expect(screen.queryByRole("dialog", { name: /crear nuevo usuario/i })).not.toBeInTheDocument();
  });

  it("calls deactivateUser when Desactivar is clicked for an active user", async () => {
    vi.mocked(usersService.deactivateUser).mockResolvedValue({
      ...mockUsers[0],
      is_active: false,
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/desactivar Luis García/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText(/desactivar Luis García/i));

    await waitFor(() => {
      expect(usersService.deactivateUser).toHaveBeenCalledWith(1);
    });
  });

  it("calls changeUserRole when role select changes", async () => {
    vi.mocked(usersService.changeUserRole).mockResolvedValue({
      ...mockUsers[0],
      role: "TRAINER",
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/cambiar rol de Luis García/i)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/cambiar rol de Luis García/i), {
      target: { value: "TRAINER" },
    });

    await waitFor(() => {
      expect(usersService.changeUserRole).toHaveBeenCalledWith(1, { new_role: "TRAINER" });
    });
  });

  it("shows empty state message when no users match filters", async () => {
    vi.mocked(usersService.getUsers).mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no se encontraron usuarios/i)).toBeInTheDocument();
    });
  });

  it("resets page to 1 when search input changes", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Luis García")).toBeInTheDocument();
    });

    const search = screen.getByLabelText(/buscar usuarios/i);
    fireEvent.change(search, { target: { value: "Luis" } });

    await waitFor(() => {
      expect(usersService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Luis", page: 1 })
      );
    });
  });

  it("shows error toast when getUsers fails", async () => {
    const { toast } = await import("sonner");
    vi.mocked(usersService.getUsers).mockRejectedValue(new Error("network"));
    renderPage();
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "No se pudieron cargar los usuarios."
      );
    });
  });
});
