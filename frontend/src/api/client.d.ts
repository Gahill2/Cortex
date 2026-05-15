/** Must match `App.tsx` localStorage key so the client can attach auth before the first React effects run. */
export declare const AUTH_STORAGE_KEY = "cortex_token";
export declare const AUTH_LOGOUT_EVENT = "cortex:auth-logout";
export declare const api: import("axios").AxiosInstance;
export declare const setAuthToken: (token: string | null) => void;
export declare const enrichTask: (title: string) => Promise<string>;
