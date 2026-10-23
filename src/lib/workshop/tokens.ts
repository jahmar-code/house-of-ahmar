import { createHash, randomBytes } from "node:crypto";
import { AGENT_TOKEN_PREFIX } from "./constants";

export type IssuedToken = {
  /** Shown to the owner exactly once. Never stored or logged. */
  token: string;
  hash: string;
  /** Safe to display: identifies a token without revealing it. */
  hint: string;
};

export function hashAgentToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function issueAgentToken(): IssuedToken {
  const token = AGENT_TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return { token, hash: hashAgentToken(token), hint: `${token.slice(0, AGENT_TOKEN_PREFIX.length + 4)}…${token.slice(-4)}` };
}

/**
 * Pulls the token out of `Authorization: Bearer …`. Anything not shaped like
 * an agent token is rejected before it costs a database lookup.
 */
export function readBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1];
  if (!token.startsWith(AGENT_TOKEN_PREFIX)) return null;
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) return null;
  return token;
}
