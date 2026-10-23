import { describe, expect, it } from "vitest";
import { hashAgentToken, issueAgentToken, readBearerToken } from "./tokens";

describe("agent tokens", () => {
  it("issues unique prefixed tokens whose hash and hint do not reveal them", () => {
    const a = issueAgentToken();
    const b = issueAgentToken();
    expect(a.token).toMatch(/^hoa_agent_[A-Za-z0-9_-]{43}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(hashAgentToken(a.token));
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hint.length).toBeLessThan(25);
    expect(a.token.includes(a.hint.replace("…", ""))).toBe(false);
  });

  it("reads only well-formed bearer tokens", () => {
    const { token } = issueAgentToken();
    expect(readBearerToken(`Bearer ${token}`)).toBe(token);
    expect(readBearerToken(`bearer   ${token}`)).toBe(token);
    expect(readBearerToken(null)).toBeNull();
    expect(readBearerToken(token)).toBeNull();
    expect(readBearerToken("Bearer sb_secret_abc")).toBeNull();
    expect(readBearerToken("Bearer hoa_agent_short")).toBeNull();
    expect(readBearerToken(`Bearer ${token}' or 1=1`)).toBeNull();
  });
});
