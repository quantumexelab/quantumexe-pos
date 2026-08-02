import crypto from "crypto";

export type BillingInterval = "monthly" | "annual";

export type PayHerePlan = {
  id: BillingInterval;
  label: string;
  amount: number;
  currency: string;
  recurrence: string;
  duration: string;
  days: number;
};

function money(n: number) {
  return Number(n).toFixed(2);
}

/** Strip copy/paste junk from Vercel / dashboard secrets. */
export function sanitizePayHereSecret(raw: string) {
  let s = String(raw || "").trim();
  // Remove wrapping quotes if pasted from .env
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  // Remove accidental whitespace / newlines inside
  s = s.replace(/\s+/g, "");
  return s;
}

export function payhereConfigured() {
  return Boolean(
    process.env.PAYHERE_MERCHANT_ID?.trim() && sanitizePayHereSecret(process.env.PAYHERE_MERCHANT_SECRET || "")
  );
}

/** Safe diagnostics for Settings UI (no secret values). */
export function payhereConfigStatus() {
  return {
    configured: payhereConfigured(),
    mode: (process.env.PAYHERE_MODE || "sandbox").toLowerCase(),
    hasMerchantId: Boolean(process.env.PAYHERE_MERCHANT_ID?.trim()),
    hasMerchantSecret: Boolean(process.env.PAYHERE_MERCHANT_SECRET?.trim()),
    hasPublicApiBase: Boolean(process.env.PUBLIC_API_BASE?.trim() || process.env.VERCEL_URL),
    hasPublicWebBase: Boolean(process.env.PUBLIC_WEB_BASE?.trim() || process.env.VERCEL_URL),
  };
}

export function payhereSandbox() {
  const mode = (process.env.PAYHERE_MODE || "sandbox").toLowerCase();
  return mode !== "live" && mode !== "production";
}

export function payhereCheckoutUrl() {
  return payhereSandbox()
    ? "https://sandbox.payhere.lk/pay/checkout"
    : "https://www.payhere.lk/pay/checkout";
}

export function getPlans(): PayHerePlan[] {
  const monthly = Number(process.env.PAYHERE_AMOUNT_MONTHLY || 2000);
  const annual = Number(process.env.PAYHERE_AMOUNT_ANNUAL || 20000);
  return [
    {
      id: "monthly",
      label: "Monthly",
      amount: monthly,
      currency: "LKR",
      recurrence: "1 Month",
      duration: "Forever",
      days: 30,
    },
    {
      id: "annual",
      label: "Annual",
      amount: annual,
      currency: "LKR",
      recurrence: "1 Year",
      duration: "Forever",
      days: 365,
    },
  ];
}

export function getPlan(interval: BillingInterval): PayHerePlan {
  const plan = getPlans().find((p) => p.id === interval);
  if (!plan) throw new Error("Invalid plan");
  return plan;
}

/** PayHere checkout hash (server-side only). */
export function createPaymentHash(input: {
  merchantId: string;
  orderId: string;
  amount: number | string;
  currency: string;
  merchantSecret: string;
}) {
  const amount = money(Number(input.amount));
  const secretHash = crypto.createHash("md5").update(input.merchantSecret).digest("hex").toUpperCase();
  return crypto
    .createHash("md5")
    .update(input.merchantId + input.orderId + amount + input.currency + secretHash)
    .digest("hex")
    .toUpperCase();
}

/** Verify notify_url md5sig. */
export function verifyNotifySignature(params: {
  merchant_id: string;
  order_id: string;
  payhere_amount: string;
  payhere_currency: string;
  status_code: string;
  md5sig: string;
}) {
  const secret = sanitizePayHereSecret(process.env.PAYHERE_MERCHANT_SECRET || "");
  if (!secret) return false;
  const secretHash = crypto.createHash("md5").update(secret).digest("hex").toUpperCase();
  const local = crypto
    .createHash("md5")
    .update(
      params.merchant_id +
        params.order_id +
        params.payhere_amount +
        params.payhere_currency +
        params.status_code +
        secretHash
    )
    .digest("hex")
    .toUpperCase();
  return local === String(params.md5sig || "").toUpperCase();
}

export function publicApiBase() {
  return (
    process.env.PUBLIC_API_BASE?.replace(/\/$/, "") ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}` : "") ||
    "http://localhost:4000"
  );
}

export function publicWebBase() {
  return (
    process.env.PUBLIC_WEB_BASE?.replace(/\/$/, "") ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}` : "") ||
    "http://localhost:5173"
  );
}

/** order_id must stay simple — PayHere rejects odd characters / long ids. */
export function buildOrderId(shopId: string, interval: BillingInterval) {
  const short = shopId.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "shop";
  const plan = interval === "annual" ? "Y" : "M";
  return `QX${plan}${short}${Date.now().toString(36)}`.slice(0, 40);
}

export function parseOrderId(orderId: string): { shopId: string; interval: BillingInterval } | null {
  // Prefer custom_1 / custom_2 from webhook; this is a weak fallback only.
  const id = String(orderId || "");
  if (!id.startsWith("QX")) return null;
  const interval: BillingInterval = id[2] === "Y" ? "annual" : "monthly";
  return { shopId: "", interval };
}

export function buildCheckoutFields(input: {
  orderId: string;
  plan: PayHerePlan;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  shopId: string;
  /** When false, one-time payment (no recurrence) — useful to debug Unauthorized errors. */
  recurring?: boolean;
}) {
  const merchantId = process.env.PAYHERE_MERCHANT_ID!.trim();
  const merchantSecret = sanitizePayHereSecret(process.env.PAYHERE_MERCHANT_SECRET || "");
  const apiBase = publicApiBase();
  const webBase = publicWebBase();
  const amount = money(input.plan.amount);
  const currency = input.plan.currency;
  const hash = createPaymentHash({
    merchantId,
    orderId: input.orderId,
    amount,
    currency,
    merchantSecret,
  });

  const recurring =
    input.recurring !== false && process.env.PAYHERE_DISABLE_RECURRING !== "1";

  const fields: Record<string, string> = {
    merchant_id: merchantId,
    return_url: `${webBase}/setting?tab=license&billing=return`,
    cancel_url: `${webBase}/setting?tab=license&billing=cancel`,
    notify_url: `${apiBase}/api/billing/webhook`,
    order_id: input.orderId,
    items: `QUANTUMEXE POS ${input.plan.label}`,
    currency,
    amount,
    first_name: input.firstName.slice(0, 40) || "Shop",
    last_name: input.lastName.slice(0, 40) || "Owner",
    email: input.email || "billing@quantumexe.local",
    phone: String(input.phone || "0700000000").replace(/[^\d+]/g, "").slice(0, 15) || "0700000000",
    address: (input.address || "Sri Lanka").slice(0, 100),
    city: (input.city || "Colombo").slice(0, 40),
    country: "Sri Lanka",
    custom_1: input.shopId.slice(0, 100),
    custom_2: input.plan.id,
    hash,
  };

  if (recurring) {
    fields.recurrence = input.plan.recurrence;
    fields.duration = input.plan.duration;
  }

  return {
    sandbox: payhereSandbox(),
    action: payhereCheckoutUrl(),
    recurring,
    fields,
  };
}
