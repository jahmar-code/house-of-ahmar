import { PgPreparedQuery } from "drizzle-orm/pg-core";
import { DrizzleQueryError } from "drizzle-orm/errors";

/**
 * Drizzle reports a failed query as `Failed query: … params: …`, and the
 * PostgreSQL error inside carries the statement, its parameters and row
 * `detail`. Server Actions do not catch database failures, so the host would
 * log message text, invite codes and contact details from any outage.
 * Keep only the SQLSTATE: enough to diagnose, nothing about the family.
 */
export class DatabaseError extends Error {
  readonly code: string | undefined;

  constructor(code?: string) {
    super(code ? `Database request failed (SQLSTATE ${code})` : "Database request failed");
    this.name = "DatabaseError";
    this.code = code;
  }
}

export function sanitizeDatabaseError(error: unknown): unknown {
  if (!(error instanceof DrizzleQueryError)) return error;
  const code = (error.cause as { code?: unknown } | undefined)?.code;
  return new DatabaseError(typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : undefined);
}

// An internal Drizzle method (hidden from its public types); the unit test fails
// loudly if an upgrade renames it.
type QueryWithCache = ((queryString: string, params: unknown[], query: () => Promise<unknown>) => Promise<unknown>) & { sanitized?: true };

/** Every Drizzle query error passes through `queryWithCache`; strip it there, once. */
export function installDatabaseErrorSanitizer(): void {
  const prototype = PgPreparedQuery.prototype as unknown as { queryWithCache: QueryWithCache };
  const original = prototype.queryWithCache;
  if (original.sanitized) return;
  const sanitized = async function (this: unknown, ...args: Parameters<QueryWithCache>) {
    try {
      return await original.apply(this, args);
    } catch (error) {
      throw sanitizeDatabaseError(error);
    }
  } as QueryWithCache;
  sanitized.sanitized = true;
  prototype.queryWithCache = sanitized;
}
