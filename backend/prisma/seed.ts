import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient, TaskStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const seedPassword =
    process.env.SEED_USER_PASSWORD?.trim() ||
    `AcmeSeed-${Date.now().toString(36)}!`;
  const passwordHash = await bcrypt.hash(seedPassword, 10);
  const org = await prisma.organization.create({
    data: {
      name: "Acme Product Team",
      users: {
        create: [
          { email: "owner@acme.dev", fullName: "Acme Owner", passwordHash },
          { email: "engineer@acme.dev", fullName: "Acme Engineer", passwordHash }
        ]
      }
    },
    include: { users: true }
  });

  const [owner, engineer] = org.users;
  const project = await prisma.project.create({
    data: {
      name: "Launchpad MVP",
      description: "Initial team tracker release",
      organizationId: org.id
    }
  });

  await prisma.task.createMany({
    data: [
      {
        title: "Design task board",
        description: "Create basic dashboard list views",
        status: TaskStatus.IN_PROGRESS,
        organizationId: org.id,
        projectId: project.id,
        assigneeId: engineer.id,
        createdById: owner.id
      },
      {
        title: "Set up auth flow",
        description: "JWT-based auth with org-scoped permissions",
        status: TaskStatus.TODO,
        organizationId: org.id,
        projectId: project.id,
        assigneeId: owner.id,
        createdById: owner.id
      }
    ]
  });

  console.log("Seed complete (set SEED_USER_PASSWORD to reproduce login for seeded users)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
