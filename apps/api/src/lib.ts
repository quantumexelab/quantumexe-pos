import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export function ok<T>(data: T, message = "OK") {
  return { success: true, message, data };
}

export function fail(message: string, status = 400) {
  return { success: false as const, message, status };
}
