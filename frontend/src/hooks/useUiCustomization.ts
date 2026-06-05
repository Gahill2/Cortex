import { useEffect, useMemo } from "react";
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
  setGoals: (goals: CortexGoal[]) => void;
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

  const setGoals = (next: CortexGoal[]) => {
    patch({ homeGoals: next });
  };

  return { ui, goals, patchUi, setGoals };
}

export function useUiCustomizationDefaults() {
  return DEFAULT_UI_CUSTOMIZATION;
}
