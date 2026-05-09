import { createContext, useContext, useMemo, useState } from "react";
import { api, setAuthToken } from "../api/client";
import type { User } from "../types";

type AuthContextValue = {
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; password: string; fullName: string; organizationName: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "launchpad_token";
const USER_KEY = "launchpad_user";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => {
    const data = localStorage.getItem(USER_KEY);
    return data ? (JSON.parse(data) as User) : null;
  });

  setAuthToken(token);

  const persist = (nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
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
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
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
