/**
 * Runs `prisma migrate deploy`, with a one-time baseline when the database
 * already has tables (e.g. from `db push`) but no _prisma_migrations history (P3005).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, '..');

// #region agent log
console.log('[prisma-deploy] bootstrap', {
  hypothesisId: 'H1-H3',
  cwd: process.cwd(),
  backendRoot,
  scriptPath: fileURLToPath(import.meta.url),
  scriptsDirExists: existsSync(join(backendRoot, 'scripts')),
  prismaDirExists: existsSync(join(backendRoot, 'prisma')),
});
// #endregion

const BASELINE_MIGRATION = '20260517200000_postgres_init';
const P3005_MARKERS = ['P3005', 'schema is not empty'];

function runPrisma(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['prisma', ...args], {
      cwd: backendRoot,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      process.stdout.write(chunk);
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk) => {
      process.stderr.write(chunk);
      stderr += chunk;
    });

    child.on('error', reject);

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject({ code: code ?? 1, stdout, stderr });
    });
  });
}

function isP3005(error) {
  const text = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  return P3005_MARKERS.some((marker) => text.includes(marker));
}

async function main() {
  try {
    await runPrisma(['migrate', 'deploy']);
    return;
  } catch (error) {
    if (!isP3005(error)) {
      process.exit(error.code ?? 1);
    }
  }

  console.log(
    '[prisma-deploy] Database schema is not empty (P3005); marking baseline migration as applied…',
  );

  try {
    await runPrisma(['migrate', 'resolve', '--applied', BASELINE_MIGRATION]);
    await runPrisma(['migrate', 'deploy']);
  } catch (error) {
    process.exit(error.code ?? 1);
  }
}

main().catch((error) => {
  console.error('[prisma-deploy] Unexpected error:', error);
  process.exit(1);
});
