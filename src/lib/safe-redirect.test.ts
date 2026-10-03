import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";
describe("same-origin redirects", () => {
  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "/\n/evil.test", "/\t/evil.test", "/\r/evil.test", "javascript:alert(1)", "", null, undefined])("rejects %j", (value) => {
    expect(safeRedirectPath(value, "/dashboard")).toBe("/dashboard");
  });
  it("keeps a normal route and encoded query", () => {
    expect(safeRedirectPath("/council?name=House%20news", "/dashboard")).toBe("/council?name=House%20news");
  });
});
