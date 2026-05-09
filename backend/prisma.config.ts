import { defineConfig } from "prisma/config";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

config({ path: join(dirname(fileURLToPath(import.meta.url)), ".env"), override: true });

export default defineConfig({
  datasourceUrl: process.env.DATABASE_URL
});
