import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
  console.log("Health check passed: database is reachable");
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("Health check failed:", err instanceof Error ? err.message : String(err));
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
