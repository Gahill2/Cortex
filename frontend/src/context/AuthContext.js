import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useMemo, useState } from "react";
import { api, setAuthToken } from "../api/client";
const AuthContext = createContext(undefined);
const TOKEN_KEY = "launchpad_token";
const USER_KEY = "launchpad_user";
export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
    const [user, setUser] = useState(() => {
        const data = localStorage.getItem(USER_KEY);
        return data ? JSON.parse(data) : null;
    });
    setAuthToken(token);
    const persist = (nextToken, nextUser) => {
        setToken(nextToken);
        setUser(nextUser);
        localStorage.setItem(TOKEN_KEY, nextToken);
        localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
        setAuthToken(nextToken);
    };
    const login = async (email, password) => {
        const response = await api.post("/auth/login", { email, password });
        persist(response.data.token, response.data.user);
    };
    const register = async (payload) => {
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
    return _jsx(AuthContext.Provider, { value: value, children: children });
};
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
};
