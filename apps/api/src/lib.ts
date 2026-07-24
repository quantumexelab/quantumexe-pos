import type { PrismaClient } from "@prisma/client";
import { prisma as fsPrisma } from "./fsdb.js";

export const prisma = fsPrisma as unknown as PrismaClient;

export function ok<T>(data: T, message = "OK") {
  return { success: true, message, data };
}

export function fail(message: string, status = 400) {
  return { success: false as const, message, status };
}

export function param(v: string | string[] | undefined) {
  return Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
}

export function parseId(v: string | string[] | undefined) {
  return Number(param(v));
}
