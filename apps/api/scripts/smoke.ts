/**
 * API smoke: login -> dashboard -> POS sale -> stock
 * Run: npx tsx apps/api/scripts/smoke.ts
 */
const API = process.env.API_URL || "http://localhost:4000/api";

async function req(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(`${path} failed: ${data.message || res.status}`);
  }
  return data;
}

async function main() {
  const login = await req("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "0771234567", password: "123456" }),
  });
  const token = login.token as string;
  const auth = { Authorization: `Bearer ${token}` };

  await req("/analytics/dashboard", { headers: auth });
  const products = await req("/stock/all-variations?hasStock=true&limit=5", { headers: auth });
  const item = products.data[0];
  if (!item) throw new Error("No stocked products");

  const invoice = await req("/pos/invoice", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      paymentType: "Cash",
      items: [{ id: item.id, stock_id: item.stockId, qty: 1, price: item.price, discount: 0 }],
    }),
  });

  console.log("SMOKE_OK", invoice.data.invoiceNo);
}

main().catch((e) => {
  console.error("SMOKE_FAIL", e);
  process.exit(1);
});
