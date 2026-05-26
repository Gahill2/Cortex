import { createContext, useContext, type ReactNode } from "react";
import { useDashboardData } from "./useDashboardData";

type DashboardDataContextValue = ReturnType<typeof useDashboardData>;

const DashboardDataContext = createContext<DashboardDataContextValue | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const value = useDashboardData();
  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardDataContext() {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error("useDashboardDataContext must be used within DashboardDataProvider");
  }
  return ctx;
}

/** Safe variant for widgets that may render outside the provider (e.g. canvas). */
export function useDashboardDataContextOptional() {
  return useContext(DashboardDataContext);
}
