import { Dispatch, SetStateAction } from "react";
export declare const usePersistentState: <T>(key: string, fallback: T) => [T, Dispatch<SetStateAction<T>>];
