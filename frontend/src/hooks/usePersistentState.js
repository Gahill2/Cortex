import { useEffect, useState } from "react";
const readStoredValue = (key, fallback) => {
    if (typeof window === "undefined")
        return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        if (raw === null)
            return fallback;
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
};
export const usePersistentState = (key, fallback) => {
    const [value, setValue] = useState(() => readStoredValue(key, fallback));
    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        }
        catch {
            // Ignore storage write failures; state remains in memory.
        }
    }, [key, value]);
    return [value, setValue];
};
