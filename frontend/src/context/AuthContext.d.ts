import type { User } from "../types";
type AuthContextValue = {
    token: string | null;
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    register: (payload: {
        email: string;
        password: string;
        fullName: string;
        organizationName: string;
    }) => Promise<void>;
    logout: () => void;
};
export declare const AuthProvider: ({ children }: {
    children: React.ReactNode;
}) => import("react/jsx-runtime").JSX.Element;
export declare const useAuth: () => AuthContextValue;
export {};
