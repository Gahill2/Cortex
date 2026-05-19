/** Full dev: Prisma migrate on each backend start + full Vite pre-bundle. */
process.env.CORTEX_DEV_FULL = "1";
await import("./dev-web.mjs");
