import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
/* Bootstrap: grid + full utilities (sm–xxl breakpoints). No reboot — keeps Cortex tokens/buttons. */
import "bootstrap/dist/css/bootstrap-grid.min.css";
import "bootstrap/dist/css/bootstrap-utilities.min.css";
import "./styles.css";
import "./styles-mail.css";
import "./styles-widgets.css";
import "./styles-ai-settings.css";
import "./styles-design.css";
import "./styles-tasks-cal.css";
import "./styles-mcp-link.css";
/* Lazyweb-informed dashboard chrome (loads last; see styles-lazyweb.css). */
import "./styles-lazyweb.css";
import "./styles-notes.css";
import "./styles-notion-app.css";
import "./styles-home-prod.css";
import "./styles-canvas.css";
import "./styles-canvas-widgets.css";
import "./styles-widget-skins.css";
import "./styles-shell.css";

if ("serviceWorker" in navigator) {
  const w = window as Window & { __ELECTRON__?: boolean };
  if (import.meta.env.DEV) {
    // Drop stale caches from prior production/preview sessions on this origin.
    void navigator.serviceWorker.getRegistrations().then((regs) =>
      Promise.all(regs.map((r) => r.unregister()))
    );
  } else if (!w.__ELECTRON__) {
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
