import { PrismaClient } from "@prisma/client";

const useFirestore = process.env.USE_FIRESTORE === "1";

export const prisma: PrismaClient = useFirestore
  ? ((await import("./fsdb.js")).prisma as unknown as PrismaClient)
  : new PrismaClient();

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
