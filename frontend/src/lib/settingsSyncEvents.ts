/** Fired when account settings are reloaded from Postgres (e.g. another device saved). */
export const CORTEX_SETTINGS_SYNC_EVENT = "cortex:settings-sync";

export type SettingsSyncDetail = {
  updatedAt: string | null;
  canvasLayoutChanged: boolean;
};
