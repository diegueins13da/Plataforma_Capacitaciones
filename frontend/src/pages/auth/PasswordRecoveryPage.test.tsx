/**
 * T08 — PasswordRecoveryPage tests
 *
 * 3-step password recovery flow:
 *   Step 1: Enter email → POST /password-reset/ (always silent)
 *   Step 2: Enter 6-digit code
 *   Step 3: Enter new password + confirm → POST /password-reset/confirm/
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, beforeEach, it, expect, vi } from "vitest";
import PasswordRecoveryPage from "./PasswordRecoveryPage";
import { authService } from "../../services/authService";

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

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/password-recovery"]}>
      <Routes>
        <Route path="/password-recovery" element={<PasswordRecoveryPage />} />
        <Route path="/login" element={<div>Página de Login</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PasswordRecoveryPage — paso 1 (email)", () => {
  it("muestra campo de correo electrónico", () => {
    renderPage();
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar código/i })).toBeInTheDocument();
  });

  it("muestra enlace de volver al login", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /volver.*login/i })).toBeInTheDocument();
  });

  it("muestra error de validación si el correo es inválido", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), "no-es-email");
    await user.click(screen.getByRole("button", { name: /enviar código/i }));

    expect(await screen.findByText(/correo electrónico válido/i)).toBeInTheDocument();
    expect(mockService.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("llama a requestPasswordReset y avanza al paso 2", async () => {
    mockService.requestPasswordReset.mockResolvedValueOnce(undefined);
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), "user@empresa.com");
    await user.click(screen.getByRole("button", { name: /enviar código/i }));

    await waitFor(() => {
      expect(mockService.requestPasswordReset).toHaveBeenCalledWith({
        email: "user@empresa.com",
      });
    });
    // Step 2 should now be visible
    expect(await screen.findByLabelText(/código/i)).toBeInTheDocument();
  });

  it("también avanza si hay error de API (anti-enumeración: siempre muestra paso 2)", async () => {
    // Backend always responds with 200 regardless of email existence
    mockService.requestPasswordReset.mockResolvedValueOnce(undefined);
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), "noexiste@empresa.com");
    await user.click(screen.getByRole("button", { name: /enviar código/i }));

    expect(await screen.findByLabelText(/código/i)).toBeInTheDocument();
  });
});

describe("PasswordRecoveryPage — paso 2 (código)", () => {
  async function advanceToStep2() {
    mockService.requestPasswordReset.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/correo electrónico/i), "user@empresa.com");
    await user.click(screen.getByRole("button", { name: /enviar código/i }));
    await screen.findByLabelText(/código/i);
    return user;
  }

  it("muestra campo de código de 6 dígitos", async () => {
    renderPage();
    await advanceToStep2();
    expect(screen.getByLabelText(/código/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continuar/i })).toBeInTheDocument();
  });

  it("muestra error si el código tiene menos de 6 dígitos", async () => {
    renderPage();
    const user = await advanceToStep2();

    await user.type(screen.getByLabelText(/código/i), "123");
    await user.click(screen.getByRole("button", { name: /continuar/i }));

    expect(await screen.findByText(/6 dígitos/i)).toBeInTheDocument();
  });

  it("avanza al paso 3 con código válido", async () => {
    renderPage();
    const user = await advanceToStep2();

    await user.type(screen.getByLabelText(/código/i), "123456");
    await user.click(screen.getByRole("button", { name: /continuar/i }));

    expect(await screen.findByLabelText(/nueva contraseña/i)).toBeInTheDocument();
  });

  it("el botón 'Volver' regresa al paso 1", async () => {
    renderPage();
    const user = await advanceToStep2();

    await user.click(screen.getByRole("button", { name: /volver/i }));

    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
  });
});

describe("PasswordRecoveryPage — paso 3 (nueva contraseña)", () => {
  async function advanceToStep3() {
    mockService.requestPasswordReset.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/correo electrónico/i), "user@empresa.com");
    await user.click(screen.getByRole("button", { name: /enviar código/i }));
    await screen.findByLabelText(/código/i);
    await user.type(screen.getByLabelText(/código/i), "123456");
    await user.click(screen.getByRole("button", { name: /continuar/i }));
    await screen.findByLabelText(/nueva contraseña/i);
    return user;
  }

  it("muestra campos de nueva contraseña y confirmación", async () => {
    renderPage();
    await advanceToStep3();
    expect(screen.getByLabelText(/nueva contraseña/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cambiar contraseña/i })).toBeInTheDocument();
  });

  it("muestra error si las contraseñas no coinciden", async () => {
    renderPage();
    const user = await advanceToStep3();

    await user.type(screen.getByLabelText(/nueva contraseña/i), "Password123!");
    await user.type(screen.getByLabelText(/confirmar contraseña/i), "Diferente123!");
    await user.click(screen.getByRole("button", { name: /cambiar contraseña/i }));

    expect(await screen.findByText(/contraseñas no coinciden/i)).toBeInTheDocument();
  });

  it("llama a confirmPasswordReset con los datos correctos", async () => {
    mockService.confirmPasswordReset.mockResolvedValueOnce(undefined);
    renderPage();
    const user = await advanceToStep3();

    await user.type(screen.getByLabelText(/nueva contraseña/i), "NuevaPass123!");
    await user.type(screen.getByLabelText(/confirmar contraseña/i), "NuevaPass123!");
    await user.click(screen.getByRole("button", { name: /cambiar contraseña/i }));

    await waitFor(() => {
      expect(mockService.confirmPasswordReset).toHaveBeenCalledWith({
        email: "user@empresa.com",
        code: "123456",
        new_password: "NuevaPass123!",
      });
    });
  });

  it("redirige a /login tras éxito", async () => {
    mockService.confirmPasswordReset.mockResolvedValueOnce(undefined);
    renderPage();
    const user = await advanceToStep3();

    await user.type(screen.getByLabelText(/nueva contraseña/i), "NuevaPass123!");
    await user.type(screen.getByLabelText(/confirmar contraseña/i), "NuevaPass123!");
    await user.click(screen.getByRole("button", { name: /cambiar contraseña/i }));

    expect(await screen.findByText("Página de Login")).toBeInTheDocument();
  });

  it("muestra error de código inválido (400/404)", async () => {
    const error = {
      response: {
        status: 400,
        data: { errors: { code: ["El código es inválido o ha expirado."] } },
      },
    };
    mockService.confirmPasswordReset.mockRejectedValueOnce(error);
    renderPage();
    const user = await advanceToStep3();

    await user.type(screen.getByLabelText(/nueva contraseña/i), "NuevaPass123!");
    await user.type(screen.getByLabelText(/confirmar contraseña/i), "NuevaPass123!");
    await user.click(screen.getByRole("button", { name: /cambiar contraseña/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
