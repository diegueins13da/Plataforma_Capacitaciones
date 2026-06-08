/**
 * Tests for CreateUserModal (P27)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateUserModal } from "./CreateUserModal";
import { usersService } from "../../services/usersService";
import type { AdminUser } from "../../types/user";
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

const mockUser: AdminUser = {
  id: 99,
  email: "nuevo@test.com",
  first_name: "Juan",
  last_name: "Pérez",
  full_name: "Juan Pérez",
  role: "USUARIO",
  is_active: true,
  must_change_password: true,
  area: "TI",
  cargo: "Dev",
  grupo_nombre: "TI",
};

const onClose = vi.fn();
const onCreated = vi.fn();

function renderModal(groups = mockGroups) {
  render(
    <CreateUserModal groups={groups} onClose={onClose} onCreated={onCreated} />
  );
}

describe("CreateUserModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with all required fields", () => {
    renderModal();
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^nombre \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^apellido \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^rol \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^área$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^cargo$/i)).toBeInTheDocument();
  });

  it("shows group select when groups are provided", () => {
    renderModal();
    expect(screen.getByLabelText(/^grupo$/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "TI" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "RRHH" })).toBeInTheDocument();
  });

  it("hides group select when no groups are passed", () => {
    renderModal([]);
    expect(screen.queryByLabelText(/^grupo$/i)).not.toBeInTheDocument();
  });

  it("calls onClose when Cancelar is clicked", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows validation errors when submitting empty form", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /crear usuario/i }));
    await waitFor(() => {
      expect(screen.getByText(/ingresa un correo electrónico válido/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/el nombre es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/el apellido es obligatorio/i)).toBeInTheDocument();
  });

  it("calls createUser service with correct payload on valid submit", async () => {
    vi.mocked(usersService.createUser).mockResolvedValue(mockUser);
    renderModal();

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), "nuevo@test.com");
    await userEvent.type(screen.getByLabelText(/^nombre \*/i), "Juan");
    await userEvent.type(screen.getByLabelText(/^apellido \*/i), "Pérez");
    await userEvent.selectOptions(screen.getByLabelText(/^rol \*/i), "USUARIO");

    fireEvent.click(screen.getByRole("button", { name: /crear usuario/i }));

    await waitFor(() => {
      expect(usersService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "nuevo@test.com",
          first_name: "Juan",
          last_name: "Pérez",
          role: "USUARIO",
        })
      );
    });
  });

  it("calls onCreated with the returned user on success", async () => {
    vi.mocked(usersService.createUser).mockResolvedValue(mockUser);
    renderModal();

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), "nuevo@test.com");
    await userEvent.type(screen.getByLabelText(/^nombre \*/i), "Juan");
    await userEvent.type(screen.getByLabelText(/^apellido \*/i), "Pérez");

    fireEvent.click(screen.getByRole("button", { name: /crear usuario/i }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(mockUser);
    });
  });

  it("maps API email error to the email field", async () => {
    const apiError = {
      response: { data: { email: ["Ya existe un usuario con este correo."] } },
    };
    vi.mocked(usersService.createUser).mockRejectedValue(apiError);
    renderModal();

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), "dup@test.com");
    await userEvent.type(screen.getByLabelText(/^nombre \*/i), "Ana");
    await userEvent.type(screen.getByLabelText(/^apellido \*/i), "López");

    fireEvent.click(screen.getByRole("button", { name: /crear usuario/i }));

    await waitFor(() => {
      expect(screen.getByText(/ya existe un usuario con este correo/i)).toBeInTheDocument();
    });
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("shows error toast when API error has no field details", async () => {
    const { toast } = await import("sonner");
    vi.mocked(usersService.createUser).mockRejectedValue(new Error("network"));
    renderModal();

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/^nombre \*/i), "X");
    await userEvent.type(screen.getByLabelText(/^apellido \*/i), "Y");

    fireEvent.click(screen.getByRole("button", { name: /crear usuario/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "No se pudo crear el usuario. Inténtalo nuevamente."
      );
    });
  });

  it("disables submit button while submitting", async () => {
    vi.mocked(usersService.createUser).mockImplementation(
      () => new Promise(() => {/* never resolves */})
    );
    renderModal();

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), "x@y.com");
    await userEvent.type(screen.getByLabelText(/^nombre \*/i), "A");
    await userEvent.type(screen.getByLabelText(/^apellido \*/i), "B");

    const submitBtn = screen.getByRole("button", { name: /crear usuario/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /creando/i })).toBeDisabled();
    });
  });
});
