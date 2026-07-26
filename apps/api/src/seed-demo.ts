import bcrypt from "bcryptjs";
import { prisma, resetFirestore } from "./fsdb.js";

export async function seedDemo() {
  await resetFirestore();

  async function ensureRole(name: string) {
    const existing = await prisma.role.findFirst({ where: { name } });
    if (existing) return existing;
    return prisma.role.create({ data: { name } });
  }
  async function ensureStatus(name: string) {
    const existing = await prisma.status.findFirst({ where: { name } });
    if (existing) return existing;
    return prisma.status.create({ data: { name } });
  }

  const [adminRole, cashierRole, storeRole] = await Promise.all([
    ensureRole("Admin"),
    ensureRole("Cashier"),
    ensureRole("Storekeeper"),
  ]);

  const [active, inactive] = await Promise.all([ensureStatus("Active"), ensureStatus("Inactive")]);

  const passwordHash = await bcrypt.hash("123456", 10);
  const admin = await prisma.user.create({
    data: {
      name: "Super Admin",
      contact: "0771234567",
      email: "admin@reox.com",
      passwordHash,
      roleId: adminRole.id,
      statusId: active.id,
      shopId: "shop_demo_quantumexe",
    },
  });

  await prisma.user.create({
    data: {
      name: "Cashier One",
      contact: "0771111111",
      email: "cashier@reox.com",
      passwordHash,
      roleId: cashierRole.id,
      statusId: active.id,
      shopId: "shop_demo_quantumexe",
    },
  });

  await prisma.user.create({
    data: {
      name: "Store Keeper",
      contact: "0772222222",
      email: "store@reox.com",
      passwordHash,
      roleId: storeRole.id,
      statusId: active.id,
      shopId: "shop_demo_quantumexe",
    },
  });

  const categoryNames = ["Milk", "other lubricants", "oil", "Groceries", "Clothing", "Electronics", "Oils", "Parts"];
  const categories = [];
  for (const name of categoryNames) {
    categories.push(await prisma.category.create({ data: { name } }));
  }
  const catOils = categories.find((c) => c.name === "Oils")!;
  const catParts = categories.find((c) => c.name === "Parts")!;
  const brandNames = ["Anchor", "lockheed", "servo", "Keells", "Samsung", "Nike", "ReoX Brand"];
  const brands = [];
  for (const name of brandNames) {
    brands.push(await prisma.brand.create({ data: { name } }));
  }
  const brand = brands.find((b) => b.name === "ReoX Brand")!;
  const unitNames = ["L", "KG", "PCS"];
  const units = [];
  for (const name of unitNames) {
    units.push(await prisma.unit.create({ data: { name } }));
  }
  const unit = units.find((u) => u.name === "PCS")!;
  const typeNames = ["Milk", "oil", "Service", "Weighted", "Standard", "Retail"];
  const productTypes = [];
  for (const name of typeNames) {
    productTypes.push(await prisma.productType.create({ data: { name } }));
  }
  const pType = productTypes.find((t) => t.name === "Retail")!;

  const products = [
    { name: "ds40 15w40", code: "P001", price: 4500, cost: 3200, qty: 40, cat: catOils.id },
    { name: "2t loos", code: "P002", price: 850, cost: 500, qty: 120, cat: catOils.id },
    { name: "lockheed 250ml", code: "P003", price: 1200, cost: 800, qty: 25, cat: catParts.id },
    { name: "brake pad set", code: "P004", price: 3500, cost: 2100, qty: 3, cat: catParts.id },
  ];

  const variants = [];
  for (const p of products) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        code: p.code,
        categoryId: p.cat,
        brandId: brand.id,
        unitId: unit.id,
        productTypeId: pType.id,
        statusId: active.id,
        variants: {
          create: {
            name: "Default",
            barcode: `BC${p.code}`,
            price: p.price,
            cost: p.cost,
          },
        },
      },
      include: { variants: true },
    });
    const v = product.variants[0];
    variants.push(v);
    await prisma.stock.create({
      data: {
        variantId: v.id,
        quantity: p.qty,
        lowThreshold: 5,
        expireDate: p.code === "P004" ? new Date(Date.now() + 5 * 86400000) : new Date(Date.now() + 365 * 86400000),
      },
    });
  }

  const companySeed = [
    { name: "LAUGFS", contact: "0777894561" },
    { name: "servo", contact: "0701234567", email: "1234@gmail.com" },
    { name: "Kist", contact: "0771112233" },
    { name: "Manchi", contact: "0772223344" },
    { name: "Coca Cola", contact: "0112345678" },
    { name: "Maliban", contact: "0118765432" },
  ];
  const companies = [];
  for (const c of companySeed) {
    companies.push(await prisma.company.create({ data: c }));
  }
  const laugfs = companies.find((c) => c.name === "LAUGFS")!;
  const servo = companies.find((c) => c.name === "servo")!;
  const commercial = await prisma.bank.create({ data: { name: "COMMERCIAL BANK OF CEYLON" } });
  const boc = await prisma.bank.create({ data: { name: "BANK OF CEYLON (BOC)" } });

  const supplier1 = await prisma.supplier.create({
    data: {
      name: "NANDA TRADINGS",
      contact: "0707894561",
      companyId: laugfs.id,
      bankId: commercial.id,
      accountNo: "000000078",
      statusId: active.id,
    },
  });
  await prisma.supplier.create({
    data: {
      name: "ammar",
      contact: "0701234569",
      email: "123456@gmail.com",
      companyId: servo.id,
      bankId: boc.id,
      accountNo: "123456789999",
      statusId: active.id,
    },
  });

  const customer1 = await prisma.customer.create({
    data: { name: "ginulla", phone: "0761234567", statusId: active.id },
  });
  await prisma.customer.create({
    data: { name: "hasan", phone: "0701234560", statusId: active.id },
  });
  await prisma.customer.create({
    data: { name: "Temporary Customer", phone: "0747272489", statusId: active.id },
  });
  await prisma.customer.create({
    data: { name: "Walk-in Customer", phone: "0700000000", statusId: active.id },
  });

  await prisma.damageReason.createMany({
    data: [{ name: "Broken" }, { name: "Expired" }, { name: "Wet Damage" }],
  });
  await prisma.returnStatus.createMany({
    data: [{ name: "Pending" }, { name: "Resolved" }, { name: "Written Off" }],
  });

  const today = new Date();
  for (let i = 0; i < 5; i++) {
    const invNo = `INV${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(i + 1).padStart(3, "0")}`;
    const v = variants[i % variants.length];
    const qty = 1 + (i % 3);
    const subtotal = v.price * qty;
    await prisma.invoice.create({
      data: {
        invoiceNo: invNo,
        customerId: customer1.id,
        userId: admin.id,
        subtotal,
        discount: 0,
        total: subtotal,
        paymentType: i % 2 === 0 ? "Cash" : "Card",
        paidAmount: subtotal,
        createdAt: new Date(Date.now() - i * 86400000),
        items: {
          create: {
            variantId: v.id,
            qty,
            price: v.price,
            discount: 0,
          },
        },
      },
    });
  }

  await prisma.grn.create({
    data: {
      supplierId: supplier1.id,
      billNo: "GRN-1001",
      totalAmount: 50000,
      paidAmount: 20000,
      items: {
        create: {
          variantId: variants[0].id,
          qty: 10,
          cost: 3200,
        },
      },
    },
  });

  await prisma.quotation.create({
    data: {
      quoteNo: "QT-0001",
      customerId: customer1.id,
      userId: admin.id,
      subtotal: 9000,
      total: 9000,
      status: "Active",
      expiresAt: new Date(Date.now() + 14 * 86400000),
      items: {
        create: { variantId: variants[0].id, qty: 2, price: 4500, discount: 0 },
      },
    },
  });

  const emp = await prisma.employee.create({
    data: { name: "Nimal Perera", contact: "0773333333", roleTitle: "Cashier", salaryBase: 45000 },
  });
  await prisma.attendance.create({
    data: {
      employeeId: emp.id,
      userId: admin.id,
      date: new Date(),
      checkIn: "09:00",
      checkOut: "17:00",
    },
  });
  await prisma.salary.create({
    data: { employeeId: emp.id, userId: admin.id, month: "2026-07", amount: 45000 },
  });

  await prisma.cashMovement.createMany({
    data: [
      { type: "IN", amount: 10000, note: "Opening float", userId: admin.id },
      { type: "OUT", amount: 2500, note: "Petty cash", userId: admin.id },
    ],
  });

  await prisma.posSession.create({
    data: { userId: admin.id, counterName: "Counter 1", openingBalance: 5000 },
  });

  const expiry = new Date("2026-07-26");
  await prisma.license.create({
    data: { licenseKey: "QX-2026-22385449", status: "VALID", expiryDate: expiry },
  });

  await prisma.setting.createMany({
    data: [
      { key: "shop_name", value: "My POS Store" },
      { key: "shop_display_name", value: "" },
      { key: "store_phone", value: "+1 234 567 8900" },
      { key: "store_email", value: "store@example.com" },
      { key: "store_address", value: "123 Main Street, City" },
      { key: "currency", value: "Rs." },
      { key: "tax_rate", value: "10" },
      { key: "stock_code_type", value: "Barcode (ID)" },
      { key: "enable_sound", value: "1" },
      { key: "quick_sale_mode", value: "0" },
      { key: "customer_display_enabled", value: "1" },
      { key: "print_language", value: "English" },
      { key: "receipt_header", value: "WELCOME TO OUR STORE" },
      { key: "receipt_footer", value: "Thank you for your purchase!" },
      { key: "show_logo", value: "1" },
      { key: "show_barcode", value: "1" },
      { key: "show_qr", value: "0" },
      { key: "auto_cut", value: "1" },
      { key: "print_date", value: "1" },
      { key: "print_time", value: "1" },
      { key: "welcome_note", value: "Please proceed to the counter" },
      { key: "business_name", value: "DEMO ACCOUNT" },
      { key: "owner_name", value: "USER DEMO" },
      { key: "max_devices", value: "2" },
      { key: "online_access", value: "No" },
      { key: "db_type", value: "offline" },
      { key: "plan_name", value: "1st Month Free (Demo)" },
      { key: "version", value: "1.0.8" },
      { key: "low_stock_threshold", value: "5" },
    ],
  });

  console.log("Seed complete. Login: 0771234567 / 123456");
  try {
    const { ensureMasterAdmin, ensureDemoShopApproved } = await import("./master/shopRegistry.js");
    await ensureMasterAdmin();
    await ensureDemoShopApproved();
  } catch (e) {
    console.warn("Master/demo shop registry seed skipped:", e instanceof Error ? e.message : e);
  }
}
