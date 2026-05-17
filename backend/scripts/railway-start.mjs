/**
 * Production entry: validate Railway env, migrate, then start API.
 * Logs clear errors to Deploy Logs when configuration is incomplete.
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`[railway-start] ${message}`);
  process.exit(1);
}

function runNode(scriptRelativePath) {
  const scriptPath = join(backendRoot, scriptRelativePath);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: backendRoot,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptRelativePath} exited with code ${code ?? 1}`));
    });
  });
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

console.log('[railway-start] starting', {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: process.env.PORT ?? '(default 4000)',
  host: process.env.HOST ?? '0.0.0.0',
  database: process.env.DATABASE_URL?.includes('@') ? 'set' : 'missing',
});

try {
  await runNode('scripts/prisma-deploy.mjs');
  await runNode('dist/src/server.js');
} catch (error) {
  console.error('[railway-start] startup failed:', error);
  process.exit(1);
}
