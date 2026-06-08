/**
 * T07 — LoginPage tests (RED → GREEN cycle)
 *
 * Strategy: mock authService at the API boundary so the real Zustand store
 * runs through its full login() action. Reset store state between tests.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, beforeEach, it, expect, vi } from "vitest";
import LoginPage from "./LoginPage";
import { useAuthStore } from "../../store/authStore";
import { authService } from "../../services/authService";

// Mock the entire authService module — vitest hoists this before imports
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

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const validLoginResponse = {
  access: "access-token-xyz",
  refresh: "refresh-token-xyz",
  user: { id: 1, email: "user@empresa.com", role: "USUARIO" as const, force_password_change: false },
};

const validMeResponseUsuario = {
  id: 1,
  email: "user@empresa.com",
  full_name: "Juan Pérez",
  role: "USUARIO" as const,
  is_active: true,
  must_change_password: false,
};

const validMeResponseAdmin = {
  ...validMeResponseUsuario,
  email: "admin@empresa.com",
  role: "ADMIN" as const,
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------
function renderLoginPage() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>Página Dashboard</div>} />
        <Route path="/admin/users" element={<div>Página Admin Usuarios</div>} />
        <Route path="/account-locked" element={<div>Cuenta Bloqueada</div>} />
        <Route path="/password-recovery" element={<div>Recuperar Contraseña</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Reset Zustand store to a clean unauthenticated state
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("LoginPage — renderizado", () => {
  it("muestra los campos de correo y contraseña", () => {
    renderLoginPage();
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument();
  });

  it("muestra el botón de enviar", () => {
    renderLoginPage();
    expect(screen.getByRole("button", { name: /ingresar/i })).toBeInTheDocument();
  });

  it("muestra enlace a recuperar contraseña", () => {
    renderLoginPage();
    expect(screen.getByRole("link", { name: /olvidaste tu contraseña/i })).toBeInTheDocument();
  });

  it("el campo de contraseña está enmascarado por defecto", () => {
    renderLoginPage();
    expect(screen.getByLabelText(/^contraseña$/i)).toHaveAttribute("type", "password");
  });
});

describe("LoginPage — toggle de contraseña", () => {
  it("muestra la contraseña al hacer clic en el botón de mostrar", async () => {
    renderLoginPage();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/^contraseña$/i);

    await user.click(screen.getByRole("button", { name: /mostrar contraseña/i }));
    expect(input).toHaveAttribute("type", "text");
  });

  it("vuelve a enmascarar al hacer clic nuevamente", async () => {
    renderLoginPage();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/^contraseña$/i);

    await user.click(screen.getByRole("button", { name: /mostrar contraseña/i }));
    await user.click(screen.getByRole("button", { name: /ocultar contraseña/i }));
    expect(input).toHaveAttribute("type", "password");
  });
});

describe("LoginPage — validaciones del formulario", () => {
  it("muestra error si el correo es inválido al enviar", async () => {
    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), "no-es-email");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(await screen.findByText(/correo electrónico válido/i)).toBeInTheDocument();
    expect(mockService.login).not.toHaveBeenCalled();
  });

  it("muestra error si la contraseña está vacía", async () => {
    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), "user@empresa.com");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(await screen.findByText(/contraseña es requerida/i)).toBeInTheDocument();
    expect(mockService.login).not.toHaveBeenCalled();
  });

  it("muestra error si ambos campos están vacíos", async () => {
    renderLoginPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(await screen.findByText(/correo electrónico válido/i)).toBeInTheDocument();
    expect(mockService.login).not.toHaveBeenCalled();
  });
});

describe("LoginPage — envío exitoso", () => {
  it("llama a login con email y password correctos", async () => {
    mockService.login.mockResolvedValueOnce(validLoginResponse);
    mockService.me.mockResolvedValueOnce(validMeResponseUsuario);
    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), "user@empresa.com");
    await user.type(screen.getByLabelText(/^contraseña$/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() => {
      expect(mockService.login).toHaveBeenCalledWith({
        email: "user@empresa.com",
        password: "Password123!",
      });
    });
  });

  it("redirige a /dashboard para rol USUARIO", async () => {
    mockService.login.mockResolvedValueOnce(validLoginResponse);
    mockService.me.mockResolvedValueOnce(validMeResponseUsuario);
    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), "user@empresa.com");
    await user.type(screen.getByLabelText(/^contraseña$/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(await screen.findByText("Página Dashboard")).toBeInTheDocument();
  });

  it("redirige a /dashboard para rol TRAINER", async () => {
    const trainerLogin = { ...validLoginResponse, user: { ...validLoginResponse.user, role: "TRAINER" as const } };
    const trainerMe = { ...validMeResponseUsuario, role: "TRAINER" as const };
    mockService.login.mockResolvedValueOnce(trainerLogin);
    mockService.me.mockResolvedValueOnce(trainerMe);
    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), "trainer@empresa.com");
    await user.type(screen.getByLabelText(/^contraseña$/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(await screen.findByText("Página Dashboard")).toBeInTheDocument();
  });

  it("redirige a /admin/users para rol ADMIN", async () => {
    const adminLogin = { ...validLoginResponse, user: { ...validLoginResponse.user, role: "ADMIN" as const } };
    mockService.login.mockResolvedValueOnce(adminLogin);
    mockService.me.mockResolvedValueOnce(validMeResponseAdmin);
    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), "admin@empresa.com");
    await user.type(screen.getByLabelText(/^contraseña$/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(await screen.findByText("Página Admin Usuarios")).toBeInTheDocument();
  });

  it("muestra spinner de carga durante el envío", async () => {
    let resolveFn!: () => void;
    mockService.login.mockReturnValueOnce(
      new Promise<typeof validLoginResponse>((resolve) => {
        resolveFn = () => resolve(validLoginResponse);
      })
    );
    mockService.me.mockResolvedValueOnce(validMeResponseUsuario);
    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), "user@empresa.com");
    await user.type(screen.getByLabelText(/^contraseña$/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(screen.getByText(/ingresando/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ingresando/i })).toBeDisabled();

    resolveFn();
  });
});

describe("LoginPage — manejo de errores del API", () => {
  it("muestra error de credenciales incorrectas con intentos restantes (401)", async () => {
    const error = {
      response: {
        status: 401,
        data: { detail: "Credenciales inválidas.", attempts_left: 3 },
      },
    };
    mockService.login.mockRejectedValueOnce(error);
    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), "user@empresa.com");
    await user.type(screen.getByLabelText(/^contraseña$/i), "WrongPass123!");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/3 intentos/i);
  });

  it("muestra error genérico de credenciales sin intentos_left (401)", async () => {
    const error = {
      response: { status: 401, data: { detail: "Credenciales inválidas." } },
    };
    mockService.login.mockRejectedValueOnce(error);
    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), "user@empresa.com");
    await user.type(screen.getByLabelText(/^contraseña$/i), "WrongPass123!");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/credenciales incorrectas/i);
  });

  it("redirige a /account-locked cuando la cuenta está bloqueada (423)", async () => {
    const error = {
      response: {
        status: 423,
        data: { locked: true, minutes_remaining: 15, message: "Cuenta bloqueada" },
      },
    };
    mockService.login.mockRejectedValueOnce(error);
    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), "user@empresa.com");
    await user.type(screen.getByLabelText(/^contraseña$/i), "WrongPass123!");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(await screen.findByText("Cuenta Bloqueada")).toBeInTheDocument();
  });

  it("redirige a /account-locked cuando la respuesta tiene locked:true (sin status 423)", async () => {
    // Edge case: backend returns locked:true inside a 401 body
    const error = {
      response: {
        status: 401,
        data: { locked: true, minutes_remaining: 10 },
      },
    };
    mockService.login.mockRejectedValueOnce(error);
    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), "user@empresa.com");
    await user.type(screen.getByLabelText(/^contraseña$/i), "WrongPass123!");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(await screen.findByText("Cuenta Bloqueada")).toBeInTheDocument();
  });

  it("muestra error de rate limit (429)", async () => {
    const error = { response: { status: 429 } };
    mockService.login.mockRejectedValueOnce(error);
    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), "user@empresa.com");
    await user.type(screen.getByLabelText(/^contraseña$/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/demasiados intentos/i);
  });

  it("el formulario vuelve a estar habilitado tras un error", async () => {
    const error = { response: { status: 401, data: {} } };
    mockService.login.mockRejectedValueOnce(error);
    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), "user@empresa.com");
    await user.type(screen.getByLabelText(/^contraseña$/i), "WrongPass!");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: /ingresar/i })).toBeEnabled();
  });
});

describe("LoginPage — enlace a recuperar contraseña", () => {
  it("navega a /password-recovery al hacer clic en el enlace", async () => {
    renderLoginPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("link", { name: /olvidaste tu contraseña/i }));
    expect(await screen.findByText("Recuperar Contraseña")).toBeInTheDocument();
  });
});
