import { prisma } from "../../db/prisma.js";

export async function getOrCreateProfile(userId: string) {
  return prisma.cortexProfile.upsert({
    where: { userId },
    update: {},
    create: { userId, subscriptionStatus: "free" }
  });
}

export async function updateProfileSubscription(
  userId: string,
  data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    subscriptionStatus?: string;
    stripeCurrentPeriodEnd?: Date | null;
  }
) {
  await getOrCreateProfile(userId);
  return prisma.cortexProfile.update({
    where: { userId },
    data
  });
}

export async function findProfileByStripeCustomer(customerId: string) {
  return prisma.cortexProfile.findFirst({
    where: { stripeCustomerId: customerId }
  });
}
