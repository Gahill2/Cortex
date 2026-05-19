import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { api, AUTH_TOKEN_KEY, setAuthToken } from "../api/client";

type User = { id: string; email: string };

type AuthContextValue = {
  ready: boolean;
  token: string | null;
  user: User | null;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        if (stored) {
          setAuthToken(stored);
          setToken(stored);
          try {
            const r = await api.get<{ user?: User }>("/auth/session");
            if (r.data?.user) setUser(r.data.user);
          } catch {
            await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
            setAuthToken(null);
            setToken(null);
          }
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const signIn = useCallback(async (nextToken: string, nextUser: User) => {
    setAuthToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, nextToken);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!token) return false;
    try {
      await api.get("/auth/session");
      return true;
    } catch {
      await signOut();
      return false;
    }
  }, [token, signOut]);

  const value = useMemo(
    () => ({ ready, token, user, signIn, signOut, refreshSession }),
    [ready, token, user, signIn, signOut, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
