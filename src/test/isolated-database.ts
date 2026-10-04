/**
 * Real-PostgreSQL concurrency fixtures for opt-in `*.database.test.ts` files.
 *
 * Each suite gets a throwaway schema on the dedicated local test database
 * (port 55322 only). Its tables are `LIKE public.* INCLUDING ALL` copies —
 * same columns, defaults, CHECKs and unique indexes, without foreign keys — and
 * the pool's search_path points unqualified Drizzle tables at them. Actions
 * therefore run their real transactions on independent connections without
 * touching E2E fixtures, and House-wide counts (members, Elders) start empty.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function localTestDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
  const parsed = new URL(url);
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname) || parsed.port !== "55322") {
    throw new Error("Refusing database fixtures outside the dedicated local test database");
  }
  return url;
}

export async function createIsolatedDatabase(tables: readonly string[]) {
  const url = localTestDatabaseUrl();
  const name = `hoa_test_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const admin = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  await admin.unsafe(`create schema ${name}`);
  for (const table of tables) {
    if (!/^[a-z_]+$/.test(table)) throw new Error("Unexpected table name");
    await admin.unsafe(`create table ${name}.${table} (like public.${table} including all)`);
  }
  const client = postgres(url, {
    max: 8,
    prepare: false,
    onnotice: () => {},
    connection: { search_path: `${name}, public`, application_name: name },
  });
  return {
    name,
    client,
    db: drizzle(client, { schema }),
    /** Sessions of this suite currently blocked on a lock (advisory or row). */
    async lockWaiters(): Promise<number> {
      const [row] = await admin`select count(*)::int as waiting from pg_stat_activity
        where application_name = ${name} and wait_event_type = 'Lock'`;
      return row.waiting;
    },
    async drop() {
      await client.end({ timeout: 5 });
      await admin.unsafe(`drop schema if exists ${name} cascade`);
      await admin.end();
    },
  };
}

export type IsolatedDatabase = Awaited<ReturnType<typeof createIsolatedDatabase>>;

/** Per-request identity for stubbed auth edges, isolated across concurrent calls. */
export const requestIdentity = new AsyncLocalStorage<{ userId: string; memberId: string; role: string; email: string }>();

export async function waitFor(condition: () => Promise<boolean> | boolean, label: string, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * Force the worst-case overlap without serializing anything: the first
 * transaction to reach its first write pauses until another request is
 * observed blocked on a lock, or has itself reached that point (which only
 * happens when locking is broken). Later arrivals continue immediately.
 */
export function contention(database: IsolatedDatabase, onFirstHolding?: () => void) {
  let arrived = 0;
  return async () => {
    arrived += 1;
    if (arrived > 1) return;
    onFirstHolding?.();
    await waitFor(async () => arrived > 1 || (await database.lockWaiters()) > 0, "a competing request");
  };
}

export interface Injection {
  /** Failure injection: drop advisory locks and SELECT ... FOR UPDATE. */
  skipLocks?: boolean;
  /** Failure injection: the first member read in a transaction reports an active Elder. */
  skipActorRecheck?: boolean;
}

type AnyFn = (...args: unknown[]) => unknown;

function isAdvisoryLock(query: unknown): boolean {
  const chunks = (query as { queryChunks?: unknown })?.queryChunks;
  return JSON.stringify(chunks ?? "").includes("pg_advisory_xact_lock");
}

/** Wrap a query builder chain so awaiting it first runs `before`, optionally dropping row locks. */
function builder<T extends object>(target: T, before: () => Promise<void>, stripRowLocks: boolean): T {
  const proxy: T = new Proxy(target, {
    get(object, property) {
      if (property === "for" && stripRowLocks) return () => proxy;
      const value = Reflect.get(object, property, object);
      if (property === "then" && typeof value === "function") {
        return (resolve: AnyFn, reject: AnyFn) => before().then(() => (value as AnyFn).call(object, resolve, reject)).catch(reject);
      }
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const result = (value as AnyFn).apply(object, args);
        return result && typeof result === "object" && "then" in result ? builder(result, before, stripRowLocks) : result;
      };
    },
  });
  return proxy;
}

/**
 * The action's real database, with test hooks only at transaction edges:
 * `beforeFirstWrite` runs once per transaction just before its first
 * INSERT/UPDATE executes (all of that transaction's reads are done by then).
 */
export function instrumentedDb(db: Db, beforeFirstWrite: () => Promise<void>, injection: Injection = {}): Db {
  const wrapTx = (tx: Db): Db => {
    let wrote = false;
    let actorRead = false;
    const gate = async () => {
      if (wrote) return;
      wrote = true;
      await beforeFirstWrite();
    };
    const none = async () => {};
    const query = new Proxy(tx.query, {
      get(object, table) {
        const relation = Reflect.get(object, table, object) as Record<string, AnyFn>;
        if (table !== "members" || !injection.skipActorRecheck) return relation;
        return {
          ...relation,
          findFirst: async (...args: unknown[]) => {
            if (!actorRead) {
              actorRead = true;
              return { isActive: true, role: "elder" };
            }
            return relation.findFirst(...args);
          },
        };
      },
    });
    return new Proxy(tx, {
      get(object, property) {
        if (property === "query") return query;
        const value = Reflect.get(object, property, object);
        if (typeof value !== "function") return value;
        if (property === "execute") {
          return (statement: unknown) =>
            injection.skipLocks && isAdvisoryLock(statement) ? Promise.resolve([]) : (value as AnyFn).call(object, statement);
        }
        if (property === "insert" || property === "update" || property === "delete") {
          return (...args: unknown[]) => builder((value as AnyFn).apply(object, args) as object, gate, false);
        }
        if (property === "select") {
          return (...args: unknown[]) => builder((value as AnyFn).apply(object, args) as object, none, Boolean(injection.skipLocks));
        }
        return value;
      },
    }) as Db;
  };
  return new Proxy(db, {
    get(object, property) {
      if (property === "transaction") {
        return (callback: (tx: Db) => Promise<unknown>, config?: unknown) =>
          object.transaction((tx) => callback(wrapTx(tx as unknown as Db)), config as never);
      }
      return Reflect.get(object, property, object);
    },
  }) as Db;
}
