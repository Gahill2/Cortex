/**
 * Open the running Cortex Vite dev app in Google Chrome (Chrome only).
 * Usage: node scripts/open-cortex.mjs
 */
import { findCortexViteUrl, openCortexInChrome } from "./cortex-dev-helpers.mjs";

const url = (await findCortexViteUrl()) ?? "http://localhost:5173";
openCortexInChrome(url);
console.log(`[cortex] ${url}`);
