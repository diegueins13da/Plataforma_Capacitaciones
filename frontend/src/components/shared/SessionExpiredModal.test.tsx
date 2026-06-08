/**
 * T08 — SessionExpiredModal tests (P05)
 *
 * Modal that appears when the Axios interceptor fires a "session:expired" event
 * (i.e., the refresh token could not be renewed).  On click → navigate to /login
 * preserving the current URL for post-login redirect.
 */
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, beforeEach, it, expect, vi } from "vitest";
import { SessionExpiredModal } from "./SessionExpiredModal";
import { useAuthStore } from "../../store/authStore";
import type { User } from "../../types";

const mockUser: User = {
  id: 1,
  email: "user@empresa.com",
  full_name: "Juan Pérez",
  role: "USUARIO",
  is_active: true,
  must_change_password: false,
};

function renderModal(initialPath = "/dashboard") {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SessionExpiredModal />
      <Routes>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/login" element={<div>Página de Login</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function dispatchSessionExpired() {
  act(() => {
    window.dispatchEvent(new CustomEvent("session:expired"));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAuthStore.setState({
    user: mockUser,
    accessToken: "access-token",
    refreshToken: "refresh-token",
    isAuthenticated: true,
    isLoading: false,
  });
});

describe("SessionExpiredModal", () => {
  it("no es visible cuando se monta inicialmente", () => {
    renderModal();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("se muestra cuando se dispara el evento session:expired", () => {
    renderModal();
    dispatchSessionExpired();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("muestra texto de sesión expirada", () => {
    renderModal();
    dispatchSessionExpired();
    expect(screen.getByText(/sesión expirada/i)).toBeInTheDocument();
  });

  it("muestra botón para volver a iniciar sesión", () => {
    renderModal();
    dispatchSessionExpired();
    expect(
      screen.getByRole("button", { name: /volver.*iniciar sesión|iniciar sesión/i })
    ).toBeInTheDocument();
  });

  it("limpia el estado de autenticación al mostrar el modal", () => {
    renderModal();
    dispatchSessionExpired();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it("navega a /login al hacer clic en el botón", async () => {
    renderModal("/dashboard");
    dispatchSessionExpired();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: /volver.*iniciar sesión|iniciar sesión/i })
    );

    expect(await screen.findByText("Página de Login")).toBeInTheDocument();
  });
});
