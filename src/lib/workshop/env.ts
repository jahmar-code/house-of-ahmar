// The Workshop's optional configuration, validated apart from the House's
// required contract in src/lib/env.ts. A malformed value here disables only the
// affected Workshop feature (and logs why); it must never 500 a family page.

export type WorkshopEnv = {
  /** Host that serves the Workshop at its root, e.g. agents.kabul-afghanistan.ca. */
  host?: string;
  /** Lower-cased emails provisioned as admins on first confirmed sign-in. */
  adminEmails: Set<string>;
  /** Bearer secret for the retention cron; unset or too short disables it. */
  cronSecret?: string;
};

const warned = new Set<string>();
function warnOnce(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[workshop] ${message}`);
}

export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => /^[^\s@]+@[^\s@]+$/.test(email))
  );
}

export function parseWorkshopHost(raw: string | undefined): string | undefined {
  const host = raw?.trim().toLowerCase();
  if (!host) return undefined;
  if (!/^[a-z0-9.-]+(:\d+)?$/.test(host)) {
    warnOnce("HOA_WORKSHOP_HOST must be a bare hostname such as agents.kabul-afghanistan.ca; subdomain routing is off.");
    return undefined;
  }
  return host;
}

export function getWorkshopEnv(): WorkshopEnv {
  const cron = process.env.CRON_SECRET || undefined;
  if (cron && cron.length < 16) warnOnce("CRON_SECRET is shorter than 16 characters; the retention cron is disabled.");
  return {
    host: parseWorkshopHost(process.env.HOA_WORKSHOP_HOST),
    adminEmails: parseAdminEmails(process.env.HOA_WORKSHOP_ADMIN_EMAILS),
    cronSecret: cron && cron.length >= 16 ? cron : undefined,
  };
}
