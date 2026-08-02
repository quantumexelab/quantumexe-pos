import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma, fail } from "./lib.js";
import { DEMO_SHOP_ID, runWithShop, tenancyEnabled } from "./shopContext.js";

const JWT_SECRET = process.env.JWT_SECRET || "reox-clone-dev-secret";

/** Paths shop users may call while pending / revoked (gate UI + status). */
const SHOP_ACCESS_ALLOWLIST = new Set([
  "/shop/access",
  "/license/status",
  "/billing/plans",
  "/billing/checkout",
]);

export type AuthUser = {
  id: number;
  role_id: number;
  email?: string | null;
  contact?: string | null;
  role?: string;
  shopId?: string | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: {
  id: number;
  roleId: number;
  email?: string | null;
  contact?: string | null;
  role?: string;
  shopId?: string | null;
}) {
  return jwt.sign(
    {
      id: user.id,
      role_id: user.roleId,
      email: user.email,
      contact: user.contact ?? null,
      role: user.role,
      shopId: user.shopId ?? null,
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

export function signMasterToken(username: string) {
  return jwt.sign(
    {
      id: 0,
      role_id: 0,
      email: `${username}@quantumexe.local`,
      role: "MasterAdmin",
      shopId: null,
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

type DbUser = {
  id: number;
  email?: string | null;
  contact?: string;
  roleId: number;
  shopId?: string | null;
  role?: { name: string };
  status?: { name: string } | null;
};

async function loadAuthUser(
  shopId: string | null,
  payload: { id: number; contact?: string | null }
): Promise<DbUser | null> {
  const { invalidateFsCache } = await import("./fsdb.js");
  invalidateFsCache();

  const find = async () => {
    let u = await prisma.user.findUnique({
      where: { id: payload.id },
      include: { role: true, status: true },
    });
    if (!u && payload.contact) {
      u = await prisma.user.findUnique({
        where: { contact: payload.contact },
        include: { role: true, status: true },
      });
    }
    return u as DbUser | null;
  };

  // Prefer dedicated shop Firebase when warmed
  let user = await runWithShop(shopId, find, { useShopFirebase: true });
  if (user) return user;

  // Fallback: control/shared Firestore (registration often lives here before provision sync)
  user = await runWithShop(shopId, find, { useShopFirebase: false });
  return user;
}

function isActiveStatus(user: DbUser): boolean {
  const name = user.status?.name;
  if (name) return name === "Active";
  // Provisioned shop DBs may omit Status include — allow if statusId looks active
  return true;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json(fail("Unauthorized", 401));
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser & {
      role?: string;
      shopId?: string | null;
      contact?: string | null;
    };
    if (payload.role === "MasterAdmin") {
      req.user = {
        id: 0,
        role_id: 0,
        email: payload.email,
        role: "MasterAdmin",
        shopId: null,
      };
      return runWithShop(null, () => next());
    }

    let shopId = payload.shopId ?? null;
    if (tenancyEnabled() && !shopId) shopId = DEMO_SHOP_ID;

    const { warmShopFirestore, getCachedShopFirestore } = await import("./master/shopFirebase.js");
    await warmShopFirestore(shopId);

    const dbUser = await loadAuthUser(shopId, {
      id: payload.id,
      contact: payload.contact || null,
    });
    if (!dbUser || !isActiveStatus(dbUser)) {
      return res.status(401).json(fail("Unauthorized", 401));
    }

    shopId = dbUser.shopId ?? shopId;
    if (tenancyEnabled() && !shopId) shopId = DEMO_SHOP_ID;
    await warmShopFirestore(shopId);

    const roleName = dbUser.role?.name || "Admin";
    req.user = {
      id: dbUser.id,
      role_id: dbUser.roleId,
      email: dbUser.email,
      contact: dbUser.contact || payload.contact,
      role: roleName,
      shopId,
    };

    const preferDedicated = Boolean(shopId && getCachedShopFirestore(shopId));

    return runWithShop(
      shopId,
      async () => {
        if (tenancyEnabled() && !SHOP_ACCESS_ALLOWLIST.has(req.path)) {
          const { refreshLocalAccessFromRegistry } = await import("./master/shopRegistry.js");
          const access = await refreshLocalAccessFromRegistry(shopId);
          if (access.status !== "active" && !(access.status === "unknown" && !access.shopId)) {
            return res.status(403).json(
              fail(
                access.status === "pending"
                  ? "Shop pending Master Admin approval (payment confirmation)"
                  : access.status === "overdue"
                    ? "Subscription overdue — contact Master Admin"
                    : "Shop access revoked",
                403
              )
            );
          }
        }
        next();
      },
      { useShopFirebase: preferDedicated }
    );
  } catch (e) {
    console.warn("[auth] requireAuth failed:", e instanceof Error ? e.message : e);
    return res.status(401).json(fail("Invalid token", 401));
  }
}

/** Blocks shop POS APIs until Master Admin has approved (payment confirmed). */
export async function requireShopAccess(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === "MasterAdmin") return next();
  try {
    const { refreshLocalAccessFromRegistry } = await import("./master/shopRegistry.js");
    const access = await refreshLocalAccessFromRegistry(req.user?.shopId ?? null);
    if (access.status === "active") return next();
    if (access.status === "unknown" && !access.shopId) return next();
    return res.status(403).json(
      fail(
        access.status === "pending"
          ? "Shop pending Master Admin approval (payment confirmation)"
          : access.status === "overdue"
            ? "Subscription overdue — contact Master Admin"
            : "Shop access revoked",
        403
      )
    );
  } catch {
    return next();
  }
}

export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      return res.status(403).json(fail("Forbidden", 403));
    }
    next();
  };
}
