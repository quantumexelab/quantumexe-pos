import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import app from "../api-dist/app.js";

const databaseUrl = defineSecret("DATABASE_URL");
const jwtSecret = defineSecret("JWT_SECRET");

setGlobalOptions({
  region: "asia-south1",
  memory: "1GiB",
  timeoutSeconds: 60,
  maxInstances: 10,
});

/** Express POS API — same routes as local `/api/*` */
export const api = onRequest(
  {
    cors: true,
    invoker: "public",
    secrets: [databaseUrl, jwtSecret],
  },
  app as any
);
