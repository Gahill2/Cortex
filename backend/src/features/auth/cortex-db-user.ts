import bcrypt from "bcrypt";
import { prisma } from "../../db/prisma.js";

const CORTEX_ORG_NAME = "Cortex";
const DEFAULT_PROJECT_NAME = "Inbox";

/**
 * Finds or creates the DB user, org, and default project for a Cortex session.
 * Called lazily when tasks/projects are first accessed.
 */
export async function getOrCreateCortexUser(userId: string, email: string) {
  // org
  let org = await prisma.organization.findFirst({ where: { name: CORTEX_ORG_NAME } });
  if (!org) {
    org = await prisma.organization.create({ data: { name: CORTEX_ORG_NAME } });
  }

  // user
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await bcrypt.hash("cortex-otp-placeholder", 6);
    try {
      user = await prisma.user.create({
        data: {
          id: userId,
          email,
          fullName: email.split("@")[0] ?? email,
          passwordHash,
          organizationId: org.id
        }
      });
    } catch {
      // race: another request created it first
      user = await prisma.user.findUnique({ where: { email } });
      if (!user) throw new Error("Failed to create cortex DB user");
    }
  }

  // default project
  let project = await prisma.project.findFirst({
    where: { organizationId: org.id, name: DEFAULT_PROJECT_NAME }
  });
  if (!project) {
    project = await prisma.project.create({
      data: { name: DEFAULT_PROJECT_NAME, organizationId: org.id }
    });
  }

  return { org, user, defaultProject: project };
}
