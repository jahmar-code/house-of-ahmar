import { describe, expect, it } from "vitest";
import { PgPreparedQuery } from "drizzle-orm/pg-core";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { DatabaseError, installDatabaseErrorSanitizer, sanitizeDatabaseError } from "./safe-errors";

const SECRET = "Only the family should ever read these words";
const pgFailure = () => Object.assign(new Error(`duplicate key value violates unique constraint: ${SECRET}`), {
  code: "23505",
  detail: `Key (code)=(${SECRET}) already exists.`,
  query: "insert into messages values ($1)",
  parameters: [SECRET],
});

describe("database errors reaching host logs", () => {
  it("keeps only the SQLSTATE of a failed query", () => {
    const error = sanitizeDatabaseError(new DrizzleQueryError("insert into messages values ($1)", [SECRET], pgFailure()));
    expect(error).toBeInstanceOf(DatabaseError);
    expect((error as DatabaseError).code).toBe("23505");
    expect(JSON.stringify({ message: (error as Error).message, ...(error as object), cause: (error as Error).cause })).not.toContain(SECRET);
    expect((error as Error).stack ?? "").not.toContain(SECRET);
  });

  it("leaves unrelated errors alone", () => {
    const other = new Error("Unauthorized");
    expect(sanitizeDatabaseError(other)).toBe(other);
  });

  it("strips parameters from every Drizzle query failure once installed", async () => {
    installDatabaseErrorSanitizer();
    installDatabaseErrorSanitizer();
    const queryWithCache = (PgPreparedQuery.prototype as unknown as {
      queryWithCache: (sql: string, params: unknown[], run: () => Promise<unknown>) => Promise<unknown>;
    }).queryWithCache;
    const failure = queryWithCache.call({ cache: undefined }, "select $1", [SECRET], async () => { throw pgFailure(); });
    await expect(failure).rejects.toBeInstanceOf(DatabaseError);
    await failure.catch((error: Error) => expect(`${error.message}${error.stack}`).not.toContain(SECRET));
  });
});
