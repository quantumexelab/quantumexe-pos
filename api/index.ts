import type { VercelRequest, VercelResponse } from "@vercel/node";
// Built Express app (compiled during Vercel buildCommand)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - resolved after apps/api build
import app from "../apps/api/dist/app.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  return (app as any)(req, res);
}
