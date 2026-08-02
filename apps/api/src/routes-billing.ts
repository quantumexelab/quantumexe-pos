import { Router } from "express";
import { z } from "zod";
import { ok, fail } from "./lib.js";
import { requireAuth, requireRoles } from "./auth.js";
import {
  applySubscriptionPayment,
  getShop,
  markSubscriptionFailed,
  resolveShopAccess,
} from "./master/shopRegistry.js";
import {
  buildCheckoutFields,
  buildOrderId,
  getPlan,
  payhereConfigStatus,
  payhereConfigured,
  payhereSandbox,
  type BillingInterval,
  verifyNotifySignature,
} from "./billing/payhere.js";

const router = Router();

const checkoutSchema = z.object({
  interval: z.enum(["monthly", "annual"]),
  recurring: z.boolean().optional(),
});

router.get("/billing/plans", requireAuth, async (req, res) => {
  try {
    const shopId = req.user?.shopId || null;
    const shop = shopId ? await getShop(shopId) : null;
    const access = shopId ? await resolveShopAccess(shopId) : null;
    res.json(
      ok({
        ...payhereConfigStatus(),
        sandbox: payhereSandbox(),
        currency: "LKR",
        plans: getPlans().map((p) => ({
          id: p.id,
          label: p.label,
          amount: p.amount,
          currency: p.currency,
          days: p.days,
          recurrence: p.recurrence,
        })),
        current: shop
          ? {
              shopId: shop.shopId,
              status: access?.status || shop.status,
              billingPlan: shop.billingPlan || shop.billingInterval || null,
              nextDueAt: shop.nextDueAt,
              lastPaidAt: shop.lastPaidAt,
              payherePaymentId: shop.payherePaymentId || null,
              payhereSubscriptionId: shop.payhereSubscriptionId || null,
              lastBillingAmount: shop.lastBillingAmount ?? null,
              paymentNote: shop.paymentNote || null,
            }
          : null,
      })
    );
  } catch (e) {
    res.status(500).json(fail(e instanceof Error ? e.message : "Failed to load plans", 500));
  }
});

router.post("/billing/checkout", requireAuth, requireRoles("Admin"), async (req, res) => {
  try {
    if (!payhereConfigured()) {
      return res.status(503).json(
        fail(
          "PayHere is not configured. Set PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET (sandbox first).",
          503
        )
      );
    }
    const parsed = checkoutSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json(fail(parsed.error.message));

    const shopId = req.user?.shopId;
    if (!shopId) return res.status(400).json(fail("No shop linked to this user"));

    const shop = await getShop(shopId);
    if (!shop) return res.status(404).json(fail("Shop not found in registry", 404));

    const interval = parsed.data.interval as BillingInterval;
    const plan = getPlan(interval);
    const orderId = buildOrderId(shopId, interval);
    const nameParts = String(shop.ownerName || "Shop Owner").trim().split(/\s+/);
    const firstName = nameParts[0] || "Shop";
    const lastName = nameParts.slice(1).join(" ") || "Owner";

    const checkout = buildCheckoutFields({
      orderId,
      plan,
      firstName,
      lastName,
      email: shop.email,
      phone: shop.phone,
      address: shop.address,
      city: shop.city,
      shopId,
      recurring: parsed.data.recurring,
    });

    res.json(
      ok({
        ...checkout,
        orderId,
        interval,
        amount: plan.amount,
        message: "Submit the returned fields as a POST form to PayHere checkout",
      })
    );
  } catch (e) {
    console.error("[billing/checkout]", e);
    res.status(500).json(fail(e instanceof Error ? e.message : "Checkout failed", 500));
  }
});

/** PayHere server notify — form-urlencoded or JSON. No auth. */
router.post("/billing/webhook", async (req, res) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const merchant_id = String(body.merchant_id || "");
    const order_id = String(body.order_id || "");
    const payhere_amount = String(body.payhere_amount || body.amount || "");
    const payhere_currency = String(body.payhere_currency || body.currency || "LKR");
    const status_code = String(body.status_code ?? "");
    const md5sig = String(body.md5sig || "");
    const payment_id = String(body.payment_id || "");
    const custom_1 = String(body.custom_1 || "");
    const custom_2 = String(body.custom_2 || "");
    const subscription_id = String(
      body.subscription_id || body.item_subscription_id || body.payment_id || ""
    );
    const recurring = String(body.recurring || "0");
    const item_rec_status = String(body.item_rec_status ?? "");

    if (!payhereConfigured()) {
      console.warn("[billing/webhook] PayHere not configured — ignoring");
      return res.status(200).send("OK");
    }

    const expectedMerchant = process.env.PAYHERE_MERCHANT_ID!.trim();
    if (merchant_id && merchant_id !== expectedMerchant) {
      console.warn("[billing/webhook] merchant_id mismatch");
      return res.status(400).send("Invalid merchant");
    }

    const valid = verifyNotifySignature({
      merchant_id,
      order_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
    });
    if (!valid) {
      console.warn("[billing/webhook] bad md5sig", { order_id, status_code });
      return res.status(400).send("Invalid signature");
    }

    const parsed = parseOrderId(order_id);
    const shopId = custom_1 || parsed?.shopId;
    const intervalRaw = (custom_2 || parsed?.interval || "monthly") as BillingInterval;
    const interval: BillingInterval = intervalRaw === "annual" ? "annual" : "monthly";

    if (!shopId) {
      console.warn("[billing/webhook] missing shopId", { order_id });
      return res.status(200).send("OK");
    }

    // Success
    if (status_code === "2") {
      await applySubscriptionPayment({
        shopId,
        interval,
        paymentId: payment_id || order_id,
        subscriptionId: subscription_id || payment_id || null,
        amount: Number(payhere_amount) || null,
        paymentNote: recurring === "1" ? `PayHere recurring ${payment_id}` : `PayHere checkout ${payment_id}`,
      });
      console.log("[billing/webhook] activated", shopId, interval, payment_id);
      return res.status(200).send("OK");
    }

    // Recurring failed / cancelled
    if (
      status_code === "-2" ||
      status_code === "-3" ||
      item_rec_status === "-2" ||
      item_rec_status === "-1"
    ) {
      await markSubscriptionFailed(shopId, `PayHere status ${status_code} rec=${item_rec_status}`);
      console.warn("[billing/webhook] marked overdue", shopId, status_code);
    }

    res.status(200).send("OK");
  } catch (e) {
    console.error("[billing/webhook]", e);
    // Always 200 to avoid endless PayHere retries on our bugs after accept — but log loudly.
    res.status(200).send("OK");
  }
});

export default router;
