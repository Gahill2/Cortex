import { Dispatch, SetStateAction, useEffect, useState } from "react";

const readStoredValue = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const usePersistentState = <T,>(key: string, fallback: T): [T, Dispatch<SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => readStoredValue(key, fallback));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage write failures; state remains in memory.
    }
  }, [key, value]);

  return [value, setValue];
};
