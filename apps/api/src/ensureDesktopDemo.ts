import bcrypt from "bcryptjs";
import { prisma } from "./lib.js";

/**
 * Desktop SQLite: ensure demo Super Admin exists so first launch always has a known login.
 * Does not overwrite an existing password if the user already logged in / changed it —
 * unless FORCE_DEMO_PASSWORD=1.
 */
export async function ensureDesktopDemoAdmin() {
  if (process.env.USE_FIRESTORE === "1") return;
  if (process.env.ELECTRON !== "1" && process.env.ENSURE_DEMO_ADMIN !== "1") return;

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

  const [adminRole, active] = await Promise.all([ensureRole("Admin"), ensureStatus("Active")]);
  await Promise.all([ensureRole("Cashier"), ensureRole("Storekeeper"), ensureStatus("Inactive")]);

  const contact = "0771234567";
  const passwordHash = await bcrypt.hash("123456", 10);
  const existing = await prisma.user.findFirst({
    where: { OR: [{ contact }, { username: contact }] },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        name: "Super Admin",
        contact,
        email: "admin@reox.com",
        passwordHash,
        roleId: adminRole.id,
        statusId: active.id,
        shopId: "shop_demo_quantumexe",
      },
    });
    console.log("[desktop] Demo admin created: 0771234567 / 123456");
    return;
  }

  // Keep demo login reliable on desktop (local SQLite only)
  await prisma.user.update({
    where: { id: existing.id },
    data: {
      passwordHash,
      roleId: adminRole.id,
      statusId: active.id,
      name: existing.name || "Super Admin",
    },
  });
  console.log("[desktop] Demo admin ready: 0771234567 / 123456");
}
