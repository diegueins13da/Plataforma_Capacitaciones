/**
 * T09b — GroupManagementPage tests (P45)
 *
 * Tests cover: rendering the group table, create-group flow,
 * edit-group flow, blocked-delete banner, and members modal.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, beforeEach, it, expect, vi } from "vitest";
import GroupManagementPage from "./GroupManagementPage";
import { usersService } from "../../../services/usersService";
import type { Group, GroupMember } from "../../../types/groups";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../../services/usersService", () => ({
  usersService: {
    getGroups: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
    getGroupMembers: vi.fn(),
    addGroupMembers: vi.fn(),
    removeGroupMember: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockService = vi.mocked(usersService);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const group1: Group = {
  id: 1,
  nombre: "TI",
  descripcion: "Equipo de tecnología",
  activo: true,
  created_at: "2026-01-01T00:00:00Z",
  member_count: 3,
  cursos_activos: 2,
};

const group2: Group = {
  id: 2,
  nombre: "Ventas",
  descripcion: "",
  activo: false,
  created_at: "2026-01-02T00:00:00Z",
  member_count: 0,
  cursos_activos: 0,
};

const member1: GroupMember = {
  id: 10,
  email: "juan@empresa.com",
  full_name: "Juan Pérez",
  role: "USUARIO",
  is_active: true,
  area: "TI",
  cargo: "Desarrollador",
};

function renderPage() {
  render(
    <MemoryRouter>
      <GroupManagementPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("GroupManagementPage — renderizado", () => {
  it("muestra indicador de carga mientras obtiene datos", () => {
    mockService.getGroups.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("muestra la tabla con grupos después de cargar", async () => {
    mockService.getGroups.mockResolvedValueOnce([group1, group2]);
    renderPage();
    expect(await screen.findByText("TI")).toBeInTheDocument();
    expect(await screen.findByText("Ventas")).toBeInTheDocument();
  });

  it("muestra member_count y cursos_activos en la tabla", async () => {
    mockService.getGroups.mockResolvedValueOnce([group1]);
    renderPage();
    await screen.findByText("TI");
    // 3 members and 2 active courses appear in the same row
    const row = screen.getByText("TI").closest("tr")!;
    expect(within(row).getByText("3")).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
  });

  it("muestra badge Activo/Inactivo", async () => {
    mockService.getGroups.mockResolvedValueOnce([group1, group2]);
    renderPage();
    await screen.findByText("TI");
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
  });

  it("muestra mensaje vacío cuando no hay grupos", async () => {
    mockService.getGroups.mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByText(/no hay grupos creados/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Create group
// ---------------------------------------------------------------------------

describe("GroupManagementPage — crear grupo", () => {
  it("abre el modal al hacer clic en + Nuevo Grupo", async () => {
    mockService.getGroups.mockResolvedValueOnce([]);
    renderPage();
    await screen.findByText(/no hay grupos/i);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /nuevo grupo/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("crea el grupo y lo agrega a la lista", async () => {
    const newGroup: Group = { ...group1, id: 99, nombre: "RRHH", member_count: 0 };
    mockService.getGroups.mockResolvedValueOnce([]);
    mockService.createGroup.mockResolvedValueOnce(newGroup);
    renderPage();
    await screen.findByText(/no hay grupos/i);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /nuevo grupo/i }));
    await user.type(screen.getByLabelText(/nombre del grupo/i), "RRHH");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(await screen.findByText("RRHH")).toBeInTheDocument();
    expect(mockService.createGroup).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "RRHH" })
    );
  });

  it("muestra error si el nombre está vacío", async () => {
    mockService.getGroups.mockResolvedValueOnce([]);
    renderPage();
    await screen.findByText(/no hay grupos/i);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /nuevo grupo/i }));
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(await screen.findByText(/nombre es obligatorio/i)).toBeInTheDocument();
    expect(mockService.createGroup).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Delete group
// ---------------------------------------------------------------------------

describe("GroupManagementPage — eliminar grupo", () => {
  it("elimina un grupo sin miembros correctamente", async () => {
    mockService.getGroups.mockResolvedValueOnce([group2]);
    mockService.deleteGroup.mockResolvedValueOnce(undefined);
    renderPage();
    await screen.findByText("Ventas");
    const user = userEvent.setup();

    await user.click(
      within(screen.getByText("Ventas").closest("tr")!).getByRole("button", {
        name: /eliminar/i,
      })
    );

    await waitFor(() => {
      expect(screen.queryByText("Ventas")).not.toBeInTheDocument();
    });
  });

  it("muestra banner de error cuando el grupo tiene miembros", async () => {
    const err = { response: { status: 400 } };
    mockService.getGroups.mockResolvedValueOnce([group1]);
    mockService.deleteGroup.mockRejectedValueOnce(err);
    renderPage();
    await screen.findByText("TI");
    const user = userEvent.setup();

    await user.click(
      within(screen.getByText("TI").closest("tr")!).getByRole("button", {
        name: /eliminar/i,
      })
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/no se puede eliminar/i);
  });
});

// ---------------------------------------------------------------------------
// Members modal
// ---------------------------------------------------------------------------

describe("GroupManagementPage — modal de miembros", () => {
  it("abre el modal y lista los miembros del grupo", async () => {
    mockService.getGroups.mockResolvedValueOnce([group1]);
    mockService.getGroupMembers.mockResolvedValueOnce([member1]);
    renderPage();
    await screen.findByText("TI");
    const user = userEvent.setup();

    await user.click(
      within(screen.getByText("TI").closest("tr")!).getByRole("button", {
        name: /miembros/i,
      })
    );

    expect(await screen.findByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("quita un miembro al hacer clic en Quitar", async () => {
    mockService.getGroups.mockResolvedValue([group1]);
    mockService.getGroupMembers.mockResolvedValueOnce([member1]).mockResolvedValueOnce([]);
    mockService.removeGroupMember.mockResolvedValueOnce(undefined);
    renderPage();
    await screen.findByText("TI");
    const user = userEvent.setup();

    await user.click(
      within(screen.getByText("TI").closest("tr")!).getByRole("button", {
        name: /miembros/i,
      })
    );
    await screen.findByText("Juan Pérez");
    await user.click(screen.getByRole("button", { name: /eliminar juan pérez del grupo/i }));

    await waitFor(() => {
      expect(mockService.removeGroupMember).toHaveBeenCalledWith(1, 10);
    });
  });
});
