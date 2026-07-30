/**
 * Full shop readiness probe against production API.
 * Run: npx tsx scripts/shop-ready-check.ts
 */
const API = process.env.API_URL || "https://quantumexe-pos.vercel.app/api";

type Result = { name: string; ok: boolean; detail?: string };

const results: Result[] = [];

async function req(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { res, data };
}

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail?: string) {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function check(name: string, fn: () => Promise<string | void>) {
  try {
    const detail = await fn();
    pass(name, detail || undefined);
  } catch (e) {
    fail(name, e instanceof Error ? e.message : String(e));
  }
}

async function main() {
  console.log(`API: ${API}\n`);

  let token = "";
  const auth = () => ({ Authorization: `Bearer ${token}` });

  await check("Health", async () => {
    const base = API.replace(/\/api$/, "");
    const h = await fetch(`${base}/health`);
    const j = await h.json();
    if (!h.ok || !j.ok) throw new Error(JSON.stringify(j));
    return "ok";
  });

  await check("Login", async () => {
    const { res, data } = await req("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "0771234567", password: "123456" }),
    });
    if (!res.ok || !data?.token) throw new Error(data?.message || String(res.status));
    token = data.token;
    return data.user?.name || "token ok";
  });

  await check("License status", async () => {
    const { res, data } = await req("/license/status", { headers: auth() });
    if (!res.ok) throw new Error(data?.message || String(res.status));
    return JSON.stringify(data?.data?.status || data);
  });

  await check("Dashboard analytics", async () => {
    const { res, data } = await req("/analytics/dashboard", { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    const k = data.data?.kpis;
    return `sales=${k?.todaysSales} products=${k?.products} customers=${k?.customers}`;
  });

  await check("Products list", async () => {
    const { res, data } = await req("/products", { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    const n = Array.isArray(data.data) ? data.data.length : 0;
    if (n < 1) throw new Error("no products");
    return `${n} products`;
  });

  await check("Stock variations", async () => {
    const { res, data } = await req("/stock/all-variations?hasStock=true&limit=5", { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    const n = data.data?.length || 0;
    if (n < 1) throw new Error("no stocked items");
    return `${n} stocked rows`;
  });

  let soldItem: any = null;
  let invoiceNo = "";

  await check("POS sale", async () => {
    const { data: products } = await req("/stock/all-variations?hasStock=true&limit=5", { headers: auth() });
    soldItem = products.data[0];
    const { res, data } = await req("/pos/invoice", {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({
        paymentType: "Cash",
        items: [{ id: soldItem.id, stock_id: soldItem.stockId, qty: 1, price: soldItem.price, discount: 0 }],
      }),
    });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    invoiceNo = data.data?.invoiceNo;
    if (!invoiceNo) throw new Error("no invoiceNo");
    return invoiceNo;
  });

  await check("Get invoice", async () => {
    const { res, data } = await req(`/pos/invoice/${invoiceNo}`, { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    return `items=${data.data?.items?.length ?? "?"}`;
  });

  await check("Sales invoices list", async () => {
    const { res, data } = await req("/sales/invoices", { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    return `count=${Array.isArray(data.data) ? data.data.length : "?"}`;
  });

  let customerId = 0;
  await check("Add customer", async () => {
    const name = `Shop Test Cust ${Date.now()}`;
    const { res, data } = await req("/customers/add", {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({ name, contact: `07${String(Date.now()).slice(-8)}`, email: "test@example.com" }),
    });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    customerId = data.data?.id;
    if (!customerId) throw new Error("no customer id");
    return `id=${customerId}`;
  });

  await check("Customers list (persist)", async () => {
    const { res, data } = await req("/customers/all", { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    const rows = data.data?.rows || data.data || [];
    if (!Array.isArray(rows)) throw new Error("unexpected customers payload");
    const found = rows.some((c: any) => c.id === customerId);
    if (!found) throw new Error("new customer not in list");
    return `total=${data.data?.total ?? rows.length}`;
  });

  await check("Suppliers list", async () => {
    const { res, data } = await req("/suppliers/list", { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    return `count=${Array.isArray(data.data) ? data.data.length : "?"}`;
  });

  await check("GRN list", async () => {
    const { res, data } = await req("/grn/list", { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    return `count=${Array.isArray(data.data) ? data.data.length : "?"}`;
  });

  await check("Users list", async () => {
    const { res, data } = await req("/users/all", { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    const n = Array.isArray(data.data) ? data.data.length : 0;
    if (n < 3) throw new Error(`expected >=3 users, got ${n}`);
    return `${n} users`;
  });

  let userId = 0;
  await check("Add user", async () => {
    const roles = await req("/roles", { headers: auth() });
    const roleRows = roles.data?.data || [];
    const cashier = roleRows.find((r: any) => /cash/i.test(r.name)) || roleRows[1] || roleRows[0];
    const contact = `07${String(Date.now()).slice(-8)}`;
    const { res, data } = await req("/users/add", {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({
        name: `Temp Cashier ${Date.now()}`,
        contact,
        email: `temp${Date.now()}@test.com`,
        password: "123456",
        role_id: cashier?.id,
      }),
    });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    userId = data.data?.id;
    return `id=${userId || "ok"} contact=${contact}`;
  });

  await check("Users persist after add", async () => {
    const { res, data } = await req("/users/all", { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    const n = data.data?.length || 0;
    if (userId && !data.data.some((u: any) => u.id === userId)) throw new Error("new user missing");
    return `total=${n}`;
  });

  await check("Quotations list", async () => {
    const { res, data } = await req("/quotations", { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    return `count=${Array.isArray(data.data) ? data.data.length : "?"}`;
  });

  await check("Employees list", async () => {
    const { res, data } = await req("/employees", { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    return `count=${Array.isArray(data.data) ? data.data.length : "?"}`;
  });

  await check("Accounts movements", async () => {
    const { res, data } = await req("/accounts/movements", { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    return `count=${Array.isArray(data.data) ? data.data.length : "?"}`;
  });

  await check("Accounts sessions", async () => {
    const { res, data } = await req("/accounts/sessions", { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    return `ok`;
  });

  await check("Reports inventory", async () => {
    const { res, data } = await req("/reports/inventory", { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    return `ok`;
  });

  await check("Reports financial", async () => {
    const { res, data } = await req("/reports/financial", { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    return `ok`;
  });

  await check("Settings get", async () => {
    const { res, data } = await req("/settings", { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    return `ok`;
  });

  await check("Backup list", async () => {
    const { res, data } = await req("/backup/list", { headers: auth() });
    if (!res.ok || data?.success === false) throw new Error(data?.message || String(res.status));
    return `ok`;
  });

  await check("Categories / brands / units", async () => {
    for (const p of ["/categories", "/brands", "/units", "/product-types"]) {
      const { res, data } = await req(p, { headers: auth() });
      if (!res.ok || data?.success === false) throw new Error(`${p}: ${data?.message || res.status}`);
    }
    return "ok";
  });

  await check("Low stock + out of stock", async () => {
    for (const p of ["/stock/low-stock", "/stock/out-of-stock", "/stock/summary-cards"]) {
      const { res, data } = await req(p, { headers: auth() });
      if (!res.ok || data?.success === false) throw new Error(`${p}: ${data?.message || res.status}`);
    }
    return "ok";
  });

  // Persistence: second login + customer still there
  await check("Re-login + data still in cloud", async () => {
    const { res, data } = await req("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "0771234567", password: "123456" }),
    });
    if (!res.ok || !data?.token) throw new Error("re-login failed");
    token = data.token;
    const cust = await req("/customers/all", { headers: auth() });
    const rows = cust.data?.data?.rows || cust.data?.data || [];
    if (!Array.isArray(rows) || !rows.some((c: any) => c.id === customerId)) {
      throw new Error("customer lost after re-login");
    }
    return "Firestore persist OK";
  });

  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);
  console.log(`\n==== SUMMARY: ${passed.length}/${results.length} passed ====`);
  if (failed.length) {
    console.log("Failed:");
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("SHOP_API_READY");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
