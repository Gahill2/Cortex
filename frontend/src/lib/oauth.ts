type ElectronWindow = Window & {
  electron?: {
    isElectron?: boolean;
    openExternal?: (url: string) => Promise<void>;
  };
};

/** Web: full-page redirect so ?spotify_connected= lands on this tab. Electron: system browser. */
export function startOAuthFlow(url: string | null | undefined): void {
  if (!url) return;
  const win = window as ElectronWindow;
  if (win.electron?.openExternal) {
    void win.electron.openExternal(url);
    return;
  }
  window.location.href = url;
}
