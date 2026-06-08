/**
 * T08 — AccountLockedPage tests (P03)
 *
 * Page reached after 5 failed login attempts (redirected from LoginPage with
 * router state { minutesRemaining: number }).
 */
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, beforeEach, afterEach, it, expect, vi } from "vitest";
import AccountLockedPage from "./AccountLockedPage";

function renderPage(minutesRemaining?: number) {
  render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: "/account-locked",
          state: minutesRemaining !== undefined ? { minutesRemaining } : undefined,
        },
      ]}
    >
      <Routes>
        <Route path="/account-locked" element={<AccountLockedPage />} />
        <Route path="/login" element={<div>Página de Login</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AccountLockedPage — renderizado", () => {
  it("muestra mensaje de cuenta bloqueada", () => {
    renderPage(15);
    expect(screen.getByText(/cuenta bloqueada/i)).toBeInTheDocument();
  });

  it("muestra los minutos restantes pasados por estado de ruta", () => {
    renderPage(10);
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it("usa 15 minutos por defecto cuando no hay estado de ruta", () => {
    renderPage();
    expect(screen.getByText(/15/)).toBeInTheDocument();
  });

  it("tiene enlace para volver al login", () => {
    renderPage(15);
    expect(screen.getByRole("link", { name: /volver.*login/i })).toBeInTheDocument();
  });
});

describe("AccountLockedPage — temporizador", () => {
  it("actualiza el contador al pasar un minuto", () => {
    renderPage(15);
    expect(screen.getByText(/15/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText(/14/)).toBeInTheDocument();
  });

  it("muestra mensaje de desbloqueo cuando llega a 0", () => {
    renderPage(1);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText(/ya puedes intentar|desbloqueada/i)).toBeInTheDocument();
  });
});

describe("AccountLockedPage — navegación", () => {
  it("navega a /login al hacer clic en el enlace", async () => {
    renderPage(15);
    vi.useRealTimers();
    const user = userEvent.setup();

    await user.click(screen.getByRole("link", { name: /volver.*login/i }));
    expect(screen.getByText("Página de Login")).toBeInTheDocument();
  });
});
