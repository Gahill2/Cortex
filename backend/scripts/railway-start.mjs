/**
 * Production entry: validate Railway env, then start API (migrations run after listen).
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`[railway-start] ${message}`);
  process.exit(1);
}

const jwt = process.env.JWT_SECRET?.trim();
if (!jwt || jwt.length < 32) {
  fail('JWT_SECRET is missing or too short (need ≥32 chars in Railway Variables).');
}

if (!process.env.DATABASE_URL?.trim()) {
  fail('DATABASE_URL is missing (add Postgres and reference ${{Postgres.DATABASE_URL}}).');
}

if (
  process.env.NODE_ENV === 'production' &&
  !process.env.CORS_ORIGINS?.trim() &&
  !process.env.CORTEX_FRONTEND_URL?.trim()
) {
  console.warn(
    '[railway-start] CORS_ORIGINS / CORTEX_FRONTEND_URL unset — set before browser clients use the API.',
  );
}

const serverEntry = join(backendRoot, 'dist/src/server.js');
if (!existsSync(serverEntry)) {
  fail(`Server build missing at ${serverEntry} — check Docker build step.`);
}

console.log('[railway-start] starting API', {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: process.env.PORT ?? '(default 4000)',
  host: process.env.HOST ?? '0.0.0.0',
  database: process.env.DATABASE_URL?.includes('@') ? 'set' : 'missing',
});

try {
  await import(pathToFileURL(serverEntry).href);
} catch (error) {
  console.error('[railway-start] server failed to start:', error);
  process.exit(1);
}
