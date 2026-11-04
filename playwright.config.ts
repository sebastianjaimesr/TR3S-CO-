import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against a real stack: `next start` + local Supabase
 * (`npx supabase start`). See docs/03-DESPLIEGUE.md, section "Pruebas".
 * Required env: E2E_BASE_URL (default http://localhost:3200) and
 * E2E_DATABASE_URL (default local Supabase Postgres) to grant the admin role.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3200",
    trace: "retain-on-failure",
    launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testMatch: /flow\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
});
