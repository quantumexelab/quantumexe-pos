import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma, fail } from "./lib.js";

const JWT_SECRET = process.env.JWT_SECRET || "reox-clone-dev-secret";

export type AuthUser = {
  id: number;
  role_id: number;
  email?: string | null;
  role?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: { id: number; roleId: number; email?: string | null }) {
  return jwt.sign(
    { id: user.id, role_id: user.roleId, email: user.email },
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
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id },
      include: { role: true, status: true },
    });
    if (!dbUser || dbUser.status.name !== "Active") {
      return res.status(401).json(fail("Unauthorized", 401));
    }
    req.user = {
      id: dbUser.id,
      role_id: dbUser.roleId,
      email: dbUser.email,
      role: dbUser.role.name,
    };
    next();
  } catch {
    return res.status(401).json(fail("Invalid token", 401));
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
