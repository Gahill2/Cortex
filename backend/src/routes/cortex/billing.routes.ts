import { Router } from "express";
import type Stripe from "stripe";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";
import { env } from "../../config/env.js";
import { getStripe, isStripeConfigured } from "../../features/billing/stripe-client.js";
import {
  findProfileByStripeCustomer,
  getOrCreateProfile,
  updateProfileSubscription
} from "../../features/billing/profile-store.js";
import { logger } from "../../utils/logger.js";

const checkoutSchema = z.object({
  priceId: z.string().min(1).optional()
});

export const cortexBillingRouter = Router();

cortexBillingRouter.get("/status", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const profile = await getOrCreateProfile(req.auth!.userId);
  sendSuccess(res, {
    configured: isStripeConfigured(),
    subscriptionStatus: profile.subscriptionStatus,
    currentPeriodEnd: profile.stripeCurrentPeriodEnd,
    priceId: profile.stripePriceId
  });
});

cortexBillingRouter.post("/checkout", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  if (!isStripeConfigured()) {
    throw new HttpError(503, "Stripe is not configured on the server.");
  }
  const { priceId } = checkoutSchema.parse(req.body ?? {});
  const price = priceId ?? env.STRIPE_PRO_PRICE_ID;
  if (!price) {
    throw new HttpError(400, "Missing priceId and STRIPE_PRO_PRICE_ID is not set.");
  }

  const stripe = getStripe();
  const profile = await getOrCreateProfile(req.auth!.userId);
  const email = req.auth!.email;

  let customerId = profile.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email });
    customerId = customer.id;
    await updateProfileSubscription(req.auth!.userId, { stripeCustomerId: customerId });
  }

  const frontend = env.CORTEX_FRONTEND_URL || "http://localhost:5173";
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: `${frontend}/?billing=success`,
    cancel_url: `${frontend}/?billing=cancel`,
    subscription_data: { trial_period_days: 14 }
  });

  sendSuccess(res, { url: session.url });
});

cortexBillingRouter.post("/portal", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  if (!isStripeConfigured()) {
    throw new HttpError(503, "Stripe is not configured.");
  }
  const profile = await getOrCreateProfile(req.auth!.userId);
  if (!profile.stripeCustomerId) {
    throw new HttpError(400, "No billing account yet. Subscribe first.");
  }

  const stripe = getStripe();
  const frontend = env.CORTEX_FRONTEND_URL || "http://localhost:5173";
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripeCustomerId,
    return_url: `${frontend}/?tab=settings`
  });
  sendSuccess(res, { url: session.url });
});

/** Mount with express.raw() in app.ts — no requireAuth */
export const cortexBillingWebhookRouter = Router();

cortexBillingWebhookRouter.post("/", async (req, res) => {
  if (!isStripeConfigured() || !env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).send("Stripe webhook not configured");
    return;
  }

  const stripe = getStripe();
  const sig = req.headers["stripe-signature"];
  if (typeof sig !== "string") {
    res.status(400).send("Missing stripe-signature");
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn("Stripe webhook signature failed", {
      error: err instanceof Error ? err.message : String(err)
    });
    res.status(400).send("Invalid signature");
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string | null;
      const subscriptionId = session.subscription as string | null;
      if (customerId) {
        const profile = await findProfileByStripeCustomer(customerId);
        if (profile) {
          await updateProfileSubscription(profile.userId, {
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: "active"
          });
        }
      }
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const profile = await findProfileByStripeCustomer(customerId);
      if (profile) {
        await updateProfileSubscription(profile.userId, {
          stripeSubscriptionId: sub.id,
          stripePriceId: sub.items.data[0]?.price.id ?? null,
          subscriptionStatus: sub.status,
          stripeCurrentPeriodEnd: new Date(sub.current_period_end * 1000)
        });
      }
    }
  } catch (err) {
    logger.error("Stripe webhook handler error", {
      error: err instanceof Error ? err.message : String(err)
    });
  }

  res.json({ received: true });
});
