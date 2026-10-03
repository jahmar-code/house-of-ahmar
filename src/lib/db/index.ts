import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { getServerEnv } from "@/lib/env";

// Validated up front: a missing DATABASE_URL used to build cleanly and then
// throw an opaque connection error on the first query.
const connectionString = getServerEnv().DATABASE_URL;

// Reuse a single client across HMR reloads in dev so we don't leak
// connections every time the module reloads.
const globalForDb = globalThis as unknown as {
  __postgresClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__postgresClient ??
  postgres(connectionString, {
    // Keep this small — Supabase session pooler caps clients per project.
    // Transaction pooler (port 6543) is preferred for serverless/dev; both work
    // with this cap in place.
    max: 5,
    idle_timeout: 20, // seconds — release connections quickly
    connect_timeout: 10,
    prepare: false, // required when using Supabase transaction pooler
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__postgresClient = client;
}

export const db = drizzle(client, { schema });
