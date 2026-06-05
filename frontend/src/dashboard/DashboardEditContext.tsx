import { createContext, useContext, type ReactNode } from "react";

export interface DashboardEditContextValue {
  editMode: boolean;
  setEditMode: (on: boolean) => void;
  libraryOpen: boolean;
  setLibraryOpen: (on: boolean) => void;
}

const DashboardEditContext = createContext<DashboardEditContextValue | null>(null);

export function DashboardEditProvider({
  value,
  children,
}: {
  value: DashboardEditContextValue;
  children: ReactNode;
}) {
  return (
    <DashboardEditContext.Provider value={value}>{children}</DashboardEditContext.Provider>
  );
}

export function useDashboardEdit(): DashboardEditContextValue {
  const ctx = useContext(DashboardEditContext);
  if (!ctx) {
    return {
      editMode: false,
      setEditMode: () => {},
      libraryOpen: false,
      setLibraryOpen: () => {},
    };
  }
  return ctx;
}
