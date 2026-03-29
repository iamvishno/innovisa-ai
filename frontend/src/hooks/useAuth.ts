import { create } from "zustand";
import { authLogin, authRegister, authMe, authRefresh } from "@/lib/api";

interface User {
  id: string;
  email: string;
  full_name: string;
  onboarding_data: Record<string, unknown> | null;
  subscription_tier: string;
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  refreshTokens: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  accessToken: localStorage.getItem("access_token"),
  refreshToken: localStorage.getItem("refresh_token"),
  isAuthenticated: !!localStorage.getItem("access_token"),
  isLoading: false,

  login: async (email, password) => {
    const data = await authLogin(email, password);
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    set({ accessToken: data.access_token, refreshToken: data.refresh_token, isAuthenticated: true });
    await get().loadUser();
  },

  register: async (email, password, fullName) => {
    const data = await authRegister(email, password, fullName);
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    set({ accessToken: data.access_token, refreshToken: data.refresh_token, isAuthenticated: true });
    await get().loadUser();
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  loadUser: async () => {
    if (!get().accessToken) return;
    set({ isLoading: true });
    try {
      const user = await authMe();
      set({ user, isLoading: false });
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isLoading: false });
    }
  },

  refreshTokens: async () => {
    const rt = get().refreshToken;
    if (!rt) return;
    try {
      const data = await authRefresh(rt);
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      set({ accessToken: data.access_token, refreshToken: data.refresh_token });
    } catch {
      get().logout();
    }
  },
}));
