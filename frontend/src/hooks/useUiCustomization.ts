import { useCallback, useEffect, useMemo } from "react";
import { usePreferences } from "../context/PreferencesContext";
import {
  applyUiCustomizationToDocument,
  DEFAULT_UI_CUSTOMIZATION,
  parseGoals,
  parseUiCustomization,
  type CortexGoal,
  type UiCustomization,
} from "../lib/uiCustomization";

export function useUiCustomization(): {
  ui: UiCustomization;
  goals: CortexGoal[];
  patchUi: (partial: Partial<UiCustomization>) => void;
  setGoals: (goals: CortexGoal[] | ((prev: CortexGoal[]) => CortexGoal[])) => void;
} {
  const { settings, patch, ready } = usePreferences();

  const ui = useMemo(
    () => parseUiCustomization(settings.extraJson?.ui),
    [settings.extraJson?.ui],
  );

  const goals = useMemo(() => {
    const fromServer = parseGoals(settings.homeGoals);
    if (fromServer.length > 0) return fromServer;
    return parseGoals(settings.extraJson?.goals);
  }, [settings.homeGoals, settings.extraJson?.goals]);

  useEffect(() => {
    if (!ready) return;
    applyUiCustomizationToDocument(ui);
  }, [ui, ready]);

  const patchUi = (partial: Partial<UiCustomization>) => {
    const next = { ...ui, ...partial };
    patch({
      extraJson: {
        ...(settings.extraJson ?? {}),
        ui: next,
      },
    });
  };

  const setGoals = useCallback(
    (next: CortexGoal[] | ((prev: CortexGoal[]) => CortexGoal[])) => {
      const current = parseGoals(settings.homeGoals);
      const fallback = parseGoals(settings.extraJson?.goals);
      const base = current.length > 0 ? current : fallback;
      const resolved = typeof next === "function" ? next(base) : next;
      patch({ homeGoals: resolved });
    },
    [patch, settings.homeGoals, settings.extraJson?.goals],
  );

  return { ui, goals, patchUi, setGoals };
}

export function useUiCustomizationDefaults() {
  return DEFAULT_UI_CUSTOMIZATION;
}
