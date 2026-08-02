import crypto from "crypto";
import jwt from "jsonwebtoken";

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

const BRIDGE_AUD = "payhere-bridge";

function money(n: number) {
  return Number(n).toFixed(2);
}

function jwtSecret() {
  return process.env.JWT_SECRET || "reox-clone-dev-secret";
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
  // Vercel / some UIs truncate trailing "=" on base64 secrets — restore padding
  if (/^[A-Za-z0-9+/]+$/.test(s) && s.length % 4 === 2) s += "==";
  else if (/^[A-Za-z0-9+/]+$/.test(s) && s.length % 4 === 3) s += "=";
  return s;
}

export function payhereConfigured() {
  return Boolean(
    process.env.PAYHERE_MERCHANT_ID?.trim() && sanitizePayHereSecret(process.env.PAYHERE_MERCHANT_SECRET || "")
  );
}

function hostLooksLikeVercelApp(url: string) {
  try {
    const host = new URL(url.includes("://") ? url : `https://${url}`).hostname;
    return /\.vercel\.app$/i.test(host) || host === "vercel.app";
  } catch {
    return /vercel\.app/i.test(url);
  }
}

/**
 * Origin that must POST to PayHere (Referer / Integrations domain).
 * Prefer PAYHERE_CHECKOUT_BASE / PAYHERE_RETURN_BASE (e.g. https://pos.quantumexe.lk).
 */
export function payhereCheckoutBase() {
  const fromEnv =
    process.env.PAYHERE_CHECKOUT_BASE?.trim() || process.env.PAYHERE_RETURN_BASE?.trim() || "";
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const web = publicWebBase().replace(/\/$/, "");
  if (web && !hostLooksLikeVercelApp(web)) return web;
  return "";
}

function resolveReturnBase() {
  const sandbox = payhereSandbox();
  const explicit = process.env.PAYHERE_RETURN_BASE?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const checkout = payhereCheckoutBase();
  if (checkout) return checkout;
  const web = publicWebBase().replace(/\/$/, "");
  // *.vercel.app cannot be registered in PayHere — localhost only for local secret testing.
  if (sandbox && hostLooksLikeVercelApp(web)) {
    return "http://localhost";
  }
  return web || (sandbox ? "http://localhost" : "");
}

/** Signed one-time handoff: vercel.app → custom domain → PayHere. */
export function signCheckoutBridge(input: { action: string; fields: Record<string, string> }) {
  return jwt.sign(
    { action: input.action, fields: input.fields },
    jwtSecret(),
    { expiresIn: "15m", audience: BRIDGE_AUD }
  );
}

export function verifyCheckoutBridge(token: string): { action: string; fields: Record<string, string> } {
  const decoded = jwt.verify(token, jwtSecret(), { audience: BRIDGE_AUD }) as {
    action?: string;
    fields?: Record<string, string>;
  };
  if (!decoded?.action || !decoded?.fields || typeof decoded.fields !== "object") {
    throw new Error("Invalid checkout bridge token");
  }
  return { action: decoded.action, fields: decoded.fields };
}

export function buildBridgeUrl(token: string) {
  const base = payhereCheckoutBase();
  if (!base) return null;
  return `${base}/api/billing/bridge?t=${encodeURIComponent(token)}`;
}

/** Safe diagnostics for Settings UI (no full secret). */
export function payhereConfigStatus() {
  const secret = sanitizePayHereSecret(process.env.PAYHERE_MERCHANT_SECRET || "");
  const returnBase = resolveReturnBase();
  const webBase = publicWebBase().replace(/\/$/, "");
  const checkoutBase = payhereCheckoutBase();
  const bridgeHost = checkoutBase || webBase;
  const publicWebNeedsCustomDomain = !checkoutBase && hostLooksLikeVercelApp(webBase);
  return {
    configured: payhereConfigured(),
    mode: (process.env.PAYHERE_MODE || "sandbox").toLowerCase(),
    hasMerchantId: Boolean(process.env.PAYHERE_MERCHANT_ID?.trim()),
    hasMerchantSecret: Boolean(secret),
    merchantId: process.env.PAYHERE_MERCHANT_ID?.trim() || null,
    secretLength: secret.length,
    secretTail: secret ? secret.slice(-4) : null,
    returnBase,
    checkoutBase: checkoutBase || null,
    notifyBase: publicApiBase(),
    hasPublicApiBase: Boolean(process.env.PUBLIC_API_BASE?.trim() || process.env.VERCEL_URL),
    hasPublicWebBase: Boolean(process.env.PUBLIC_WEB_BASE?.trim() || process.env.VERCEL_URL),
    /** false when checkout still stuck on *.vercel.app with no custom bridge domain */
    publicWebCheckoutOk: Boolean(checkoutBase) || !hostLooksLikeVercelApp(bridgeHost),
    publicWebNeedsCustomDomain,
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

  const sandbox = payhereSandbox();

  /**
   * PayHere Merchant Secret is bound to the Integrations domain/app.
   * *.vercel.app cannot be registered → use a real domain + PAYHERE_RETURN_BASE / PUBLIC_WEB_BASE.
   */
  const returnBase = resolveReturnBase() || webBase.replace(/\/$/, "");

  const fields: Record<string, string> = {
    merchant_id: merchantId,
    return_url: `${returnBase}/setting?tab=license&billing=return`,
    cancel_url: `${returnBase}/setting?tab=license&billing=cancel`,
    notify_url: `${apiBase}/api/billing/webhook`,
    order_id: input.orderId,
    items: `QUANTUMEXE POS ${input.plan.label}`,
    currency,
    amount,
    first_name: input.firstName.slice(0, 40) || "Shop",
    last_name: input.lastName.slice(0, 40) || "Owner",
    email: /@/.test(input.email || "") && !String(input.email).endsWith(".local")
      ? input.email
      : "saman@gmail.com",
    phone: (() => {
      const p = String(input.phone || "").replace(/[^\d]/g, "");
      if (p.length >= 9) return p.slice(-10);
      return "0771234567";
    })(),
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
    sandbox,
    action: payhereCheckoutUrl(),
    recurring,
    returnBase,
    fields,
  };
}
