/**
 * T08 — ForceChangePasswordPage tests (P04)
 *
 * Required gate for users with must_change_password = true.
 * ProtectedRoute redirects them here; after changing they can proceed.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, beforeEach, it, expect, vi } from "vitest";
import ForceChangePasswordPage from "./ForceChangePasswordPage";
import { useAuthStore } from "../../store/authStore";
import { authService } from "../../services/authService";
import type { User } from "../../types";

vi.mock("../../services/authService", () => ({
  authService: {
    login: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
    requestPasswordReset: vi.fn(),
    confirmPasswordReset: vi.fn(),
    changePassword: vi.fn(),
    refreshToken: vi.fn(),
  },
}));

const mockService = vi.mocked(authService);

const usuarioUser: User = {
  id: 1,
  email: "user@empresa.com",
  full_name: "Juan Pérez",
  role: "USUARIO",
  is_active: true,
  must_change_password: true,
};

const adminUser: User = {
  ...usuarioUser,
  role: "ADMIN",
  email: "admin@empresa.com",
};

// `_targetUser` is unused at runtime but documents which user the test scenario targets
function renderPage(_targetUser?: User) {
  render(
    <MemoryRouter initialEntries={["/change-password"]}>
      <Routes>
        <Route path="/change-password" element={<ForceChangePasswordPage />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/admin/users" element={<div>Admin Usuarios</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAuthStore.setState({
    user: usuarioUser,
    accessToken: "access-token",
    refreshToken: "refresh-token",
    isAuthenticated: true,
    isLoading: false,
  });
});

describe("ForceChangePasswordPage — renderizado", () => {
  it("muestra los tres campos del formulario", () => {
    renderPage();
    expect(screen.getByLabelText(/contraseña actual/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nueva contraseña/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cambiar contraseña/i })).toBeInTheDocument();
  });

  it("muestra contexto explicativo de por qué debe cambiar la contraseña", () => {
    renderPage();
    expect(screen.getByText(/debes cambiar tu contraseña/i)).toBeInTheDocument();
  });
});

describe("ForceChangePasswordPage — validaciones", () => {
  it("muestra error si la contraseña actual está vacía", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /cambiar contraseña/i }));
    expect(await screen.findByText(/contraseña actual.*requerida/i)).toBeInTheDocument();
  });

  it("muestra error si las contraseñas nuevas no coinciden", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/contraseña actual/i), "OldPass123!");
    await user.type(screen.getByLabelText(/nueva contraseña/i), "NewPass123!");
    await user.type(screen.getByLabelText(/confirmar contraseña/i), "DifferentPass123!");
    await user.click(screen.getByRole("button", { name: /cambiar contraseña/i }));
    expect(await screen.findByText(/contraseñas no coinciden/i)).toBeInTheDocument();
  });

  it("muestra error si la nueva contraseña no cumple la política", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/contraseña actual/i), "OldPass123!");
    await user.type(screen.getByLabelText(/nueva contraseña/i), "sinmayus1!");
    await user.type(screen.getByLabelText(/confirmar contraseña/i), "sinmayus1!");
    await user.click(screen.getByRole("button", { name: /cambiar contraseña/i }));
    expect(await screen.findByText(/mayúscula/i)).toBeInTheDocument();
  });
});

describe("ForceChangePasswordPage — envío exitoso", () => {
  it("llama a changePassword con datos correctos", async () => {
    mockService.changePassword.mockResolvedValueOnce(undefined);
    mockService.me.mockResolvedValueOnce({ ...usuarioUser, must_change_password: false });
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/contraseña actual/i), "OldPass123!");
    await user.type(screen.getByLabelText(/nueva contraseña/i), "NewPass123!");
    await user.type(screen.getByLabelText(/confirmar contraseña/i), "NewPass123!");
    await user.click(screen.getByRole("button", { name: /cambiar contraseña/i }));

    await waitFor(() => {
      expect(mockService.changePassword).toHaveBeenCalledWith({
        current_password: "OldPass123!",
        new_password: "NewPass123!",
      });
    });
  });

  it("redirige a /dashboard para rol USUARIO tras éxito", async () => {
    mockService.changePassword.mockResolvedValueOnce(undefined);
    mockService.me.mockResolvedValueOnce({ ...usuarioUser, must_change_password: false });
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/contraseña actual/i), "OldPass123!");
    await user.type(screen.getByLabelText(/nueva contraseña/i), "NewPass123!");
    await user.type(screen.getByLabelText(/confirmar contraseña/i), "NewPass123!");
    await user.click(screen.getByRole("button", { name: /cambiar contraseña/i }));

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });

  it("redirige a /admin/users para rol ADMIN tras éxito", async () => {
    useAuthStore.setState({ user: adminUser, isAuthenticated: true, isLoading: false });
    mockService.changePassword.mockResolvedValueOnce(undefined);
    mockService.me.mockResolvedValueOnce({ ...adminUser, must_change_password: false });
    renderPage(adminUser);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/contraseña actual/i), "OldPass123!");
    await user.type(screen.getByLabelText(/nueva contraseña/i), "NewPass123!");
    await user.type(screen.getByLabelText(/confirmar contraseña/i), "NewPass123!");
    await user.click(screen.getByRole("button", { name: /cambiar contraseña/i }));

    expect(await screen.findByText("Admin Usuarios")).toBeInTheDocument();
  });
});

describe("ForceChangePasswordPage — errores de API", () => {
  it("muestra error cuando la contraseña actual es incorrecta (400)", async () => {
    const error = {
      response: {
        status: 400,
        data: { errors: { current_password: ["La contraseña actual es incorrecta."] } },
      },
    };
    mockService.changePassword.mockRejectedValueOnce(error);
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/contraseña actual/i), "WrongOldPass!");
    await user.type(screen.getByLabelText(/nueva contraseña/i), "NewPass123!");
    await user.type(screen.getByLabelText(/confirmar contraseña/i), "NewPass123!");
    await user.click(screen.getByRole("button", { name: /cambiar contraseña/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
