import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/tests/**/*.test.ts"],
    setupFiles: ["src/tests/setup-env.ts"],
    // Full app import (googleapis, routes) can exceed 10s on cold Windows runs.
    hookTimeout: 60_000,
  },
});
