// In-memory sliding-window rate limiter.
//
// NOTE: state is per server instance, so on serverless (Vercel) a cold start
// resets it and concurrent lambdas don't share counts. It deters casual abuse
// (e.g. brute-forcing an access code) but is NOT a substitute for a shared
// store (Upstash/Redis) at scale — swap these helpers for a Redis-backed
// version before the House grows large. See CLAUDE.md § Known limitations.
//
// Callers should prefer `checkRateLimit` + `recordFailedAttempt` over the
// consume-on-check `rateLimit`: only *failures* should cost a relative their
// attempts, so getting it right first time never counts against them.
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Buckets are only ever created, never swept on a timer, so prune expired ones
// opportunistically once the map is large enough to be worth walking.
const PRUNE_THRESHOLD = 500;

export type RateLimitResult = { allowed: boolean; retryAfterMs: number };

function prune(now: number) {
  if (buckets.size < PRUNE_THRESHOLD) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/**
 * Read-only check — does NOT consume an attempt. Pair with
 * `recordFailedAttempt` on the failure path and `clearRateLimit` on success.
 */
export function checkRateLimit(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) return { allowed: true, retryAfterMs: 0 };
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }
  return { allowed: true, retryAfterMs: 0 };
}

/** Count one failure against `key`, opening a fresh window if none is open. */
export function recordFailedAttempt(key: string, windowMs: number): void {
  const now = Date.now();
  prune(now);

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
}

/** Forget a key's failures — call this on the success path. */
export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

/**
 * Consume-on-check variant: every call counts, whether it succeeded or not.
 * Use it only where the *request itself* is the thing being throttled.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  prune(now);

  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}
