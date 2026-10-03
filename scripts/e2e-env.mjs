import { config } from "dotenv";

export function loadTestEnv() {
  const result = config({ path: ".env.e2e.local", override: true, quiet: true });
  if (result.error) throw new Error("Run npm run test:e2e:prepare first.");
  for (const key of ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SITE_URL"]) {
    const host = new URL(process.env[key] ?? "").hostname;
    if (!["127.0.0.1", "localhost", "[::1]"].includes(host)) {
      throw new Error(`E2E refuses non-loopback ${key}. Family data must never be test fixtures.`);
    }
  }
  if (new URL(process.env.DATABASE_URL).port !== "55322") {
    throw new Error("E2E requires the dedicated test database on port 55322.");
  }
  if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).port !== "55321" ||
      new URL(process.env.NEXT_PUBLIC_SITE_URL).port !== "3217") {
    throw new Error("E2E requires the dedicated local API and app ports.");
  }
  // Keep test browser bundles separate: NEXT_PUBLIC values are build-inlined,
  // so a production .next artifact must never be reused with local fixtures.
  return { ...process.env, HOA_E2E: "1" };
}
