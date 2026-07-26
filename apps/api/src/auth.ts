import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma, fail } from "./lib.js";
import { DEMO_SHOP_ID, runWithShop, tenancyEnabled } from "./shopContext.js";

const JWT_SECRET = process.env.JWT_SECRET || "reox-clone-dev-secret";

export type AuthUser = {
  id: number;
  role_id: number;
  email?: string | null;
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
  role?: string;
  shopId?: string | null;
}) {
  return jwt.sign(
    {
      id: user.id,
      role_id: user.roleId,
      email: user.email,
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

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json(fail("Unauthorized", 401));
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser & { role?: string; shopId?: string | null };
    if (payload.role === "MasterAdmin") {
      req.user = {
        id: 0,
        role_id: 0,
        email: payload.email,
        role: "MasterAdmin",
        shopId: null,
      };
      // Master sees all shops (no tenant filter)
      return runWithShop(null, () => next());
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id },
      include: { role: true, status: true },
    });
    if (!dbUser || dbUser.status.name !== "Active") {
      return res.status(401).json(fail("Unauthorized", 401));
    }

    let shopId = (dbUser as { shopId?: string | null }).shopId ?? payload.shopId ?? null;
    if (tenancyEnabled() && !shopId) {
      shopId = DEMO_SHOP_ID;
    }

    req.user = {
      id: dbUser.id,
      role_id: dbUser.roleId,
      email: dbUser.email,
      role: dbUser.role.name,
      shopId,
    };
    return runWithShop(shopId, () => next());
  } catch {
    return res.status(401).json(fail("Invalid token", 401));
  }
}

/** Blocks shop POS APIs until Master Admin has approved (payment confirmed). */
export async function requireShopAccess(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === "MasterAdmin") return next();
  try {
    const { refreshLocalAccessFromRegistry } = await import("./master/shopRegistry.js");
    const access = await refreshLocalAccessFromRegistry();
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
