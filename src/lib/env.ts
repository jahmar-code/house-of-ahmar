import { z } from "zod";

/**
 * The House's environment contract, validated once with Zod.
 *
 * Every consumer used to reach for `process.env.X!`, so a deploy with a missing
 * variable built cleanly and then 500'd on the first request — a white screen
 * for a relative on a phone instead of a red line in the build log.
 * `getServerEnv()` fails loudly instead, naming every variable that is missing
 * or malformed.
 *
 * NOTE: `NEXT_PUBLIC_*` values are inlined by the bundler at build time, so they
 * must be read as literal `process.env.NEXT_PUBLIC_…` expressions — never off a
 * dynamically-keyed object, or the replacement never happens.
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("must be the Supabase project URL (https://<ref>.supabase.co)"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "is required (Supabase publishable/anon key)"),
  DATABASE_URL: z.string().min(1, "is required (Supabase Postgres connection string)"),
  // Optional, but strongly recommended in production: it is what pins auth email
  // links and the post-confirmation redirect to the real origin.
  NEXT_PUBLIC_SITE_URL: z.string().url("must be an absolute URL").optional(),
  // First-boot only. Once the House has its first Elder this code is retired.
  HOA_DEFAULT_ACCESS_CODE: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Thrown when the process is missing (or mis-spelling) a required variable. */
export class MissingEnvError extends Error {
  constructor(details: string) {
    super(
      `Environment is not configured — ${details}. ` +
        `Set these in .env.local (or your host's environment) and restart.`
    );
    this.name = "MissingEnvError";
  }
}

/**
 * Reads the raw values. An unset variable and an empty string mean the same
 * thing here — "not configured" — so both normalise to `undefined`.
 */
function readRawEnv() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
    DATABASE_URL: process.env.DATABASE_URL || undefined,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
    HOA_DEFAULT_ACCESS_CODE: process.env.HOA_DEFAULT_ACCESS_CODE || undefined,
  };
}

let cached: ServerEnv | null = null;

/**
 * Validated environment, parsed once per process. Throws `MissingEnvError`
 * listing every problem at once rather than failing on whichever `!` happens to
 * be dereferenced first.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(readRawEnv());
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")} ${issue.message}`)
      .join("; ");
    throw new MissingEnvError(details);
  }

  cached = parsed.data;
  return cached;
}
