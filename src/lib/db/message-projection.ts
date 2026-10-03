import { sql } from "drizzle-orm";
import { messages } from "./schema";

/** Date fields remain convenient for display; this preserves exact sort order. */
export const MESSAGE_PRECISION_COLUMNS = {
  createdAtMicros: sql<string>`(extract(epoch from ${messages.createdAt}) * 1000000)::bigint::text`.as("created_at_micros"),
};
