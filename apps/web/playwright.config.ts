import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "npm run dev -w apps/api",
      url: "http://localhost:4000/health",
      reuseExistingServer: true,
      cwd: "../..",
      timeout: 120000,
    },
    {
      command: "npm run dev -w apps/web",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      cwd: "../..",
      timeout: 120000,
    },
  ],
  projects: [{ name: "msedge", use: { ...devices["Desktop Edge"], channel: "msedge" } }],
});
