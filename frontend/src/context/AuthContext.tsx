import { createContext, useContext, useMemo, useState } from "react";
import {
  api,
  setAuthToken,
  AUTH_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  migrateLegacyAuthStorage,
} from "../api/client";
import type { User } from "../types";

type AuthContextValue = {
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; password: string; fullName: string; organizationName: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const LEGACY_AUTH_TOKEN_KEY = "launchpad_token";
const LEGACY_AUTH_USER_KEY = "launchpad_user";

function readInitialAuth(): { token: string | null; user: User | null } {
  migrateLegacyAuthStorage();
  const token = localStorage.getItem(AUTH_STORAGE_KEY);
  const userRaw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
  let user: User | null = null;
  if (userRaw) {
    try {
      user = JSON.parse(userRaw) as User;
    } catch {
      user = null;
    }
  }
  return { token, user };
}

let cachedInitialAuth: { token: string | null; user: User | null } | undefined;

function getInitialAuth(): { token: string | null; user: User | null } {
  if (!cachedInitialAuth) cachedInitialAuth = readInitialAuth();
  return cachedInitialAuth;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => getInitialAuth().token);
  const [user, setUser] = useState<User | null>(() => getInitialAuth().user);

  setAuthToken(token);

  const persist = (nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem(AUTH_STORAGE_KEY, nextToken);
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(nextUser));
    localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_AUTH_USER_KEY);
    setAuthToken(nextToken);
  };

  const login = async (email: string, password: string) => {
    const response = await api.post("/auth/login", { email, password });
    persist(response.data.token, response.data.user);
  };

  const register = async (payload: { email: string; password: string; fullName: string; organizationName: string }) => {
    const response = await api.post("/auth/register", payload);
    persist(response.data.token, response.data.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_AUTH_USER_KEY);
    setAuthToken(null);
  };

  const value = useMemo(() => ({ token, user, login, register, logout }), [token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
