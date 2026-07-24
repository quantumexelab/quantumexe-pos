import { onRequest } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import app from "../api-dist/app.js";

if (!getApps().length) {
  initializeApp();
}

export const api = onRequest(
  {
    region: "asia-south1",
    memory: "1GiB",
    timeoutSeconds: 120,
    cors: true,
  },
  app
);
