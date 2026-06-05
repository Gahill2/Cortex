import { useEffect, useState } from "react";
import { AUTH_CHANGED_EVENT, AUTH_LOGOUT_EVENT, AUTH_STORAGE_KEY } from "../api/client";

function readToken(): string | null {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Session JWT for components outside AuthProvider (App manages auth separately). */
export function useCortexSessionToken(): string | null {
  const [token, setToken] = useState(readToken);

  useEffect(() => {
    const sync = () => setToken(readToken());
    window.addEventListener(AUTH_LOGOUT_EVENT, sync);
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener(AUTH_LOGOUT_EVENT, sync);
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
    };
  }, []);

  return token;
}
