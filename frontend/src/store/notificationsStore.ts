import { create } from "zustand";
import api from "../services/api";

export interface AppNotification {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  referencia_id: number | null;
  referencia_tipo: string;
  created_at: string;
}

interface NotificationsState {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  fetch: () => Promise<void>;
  markRead: (id?: number) => Promise<void>;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await api.get<{ results: AppNotification[]; unread_count: number }>(
        "/v1/notifications/"
      );
      set({ notifications: res.data.results, unreadCount: res.data.unread_count });
    } finally {
      set({ loading: false });
    }
  },

  markRead: async (id?: number) => {
    const url = id ? `/v1/notifications/mark-read/${id}/` : "/v1/notifications/mark-read/";
    try {
      const res = await api.post<{ unread_count: number }>(url);
      const { notifications } = get();
      const updated = id
        ? notifications.map((n) => (n.id === id ? { ...n, leida: true } : n))
        : notifications.map((n) => ({ ...n, leida: true }));
      set({ notifications: updated, unreadCount: res.data.unread_count });
    } catch { /* silent */ }
  },
}));
