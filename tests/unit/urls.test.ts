import { describe, expect, it } from "vitest";

import { safeCallbackUrl, signInHref } from "@/lib/urls";

describe("safeCallbackUrl", () => {
  it("allows plain relative paths", () => {
    expect(safeCallbackUrl("/dashboard/profile")).toBe("/dashboard/profile");
    expect(safeCallbackUrl("/browse?type=MAKERSPACE")).toBe("/browse?type=MAKERSPACE");
  });

  it("falls back when the value is missing or not a string", () => {
    expect(safeCallbackUrl(undefined)).toBe("/dashboard");
    expect(safeCallbackUrl(null)).toBe("/dashboard");
    expect(safeCallbackUrl([] as unknown as string[])).toBe("/dashboard");
  });

  it("uses the first value of a repeated query param", () => {
    expect(safeCallbackUrl(["/messages", "/evil"])).toBe("/messages");
  });

  it("honours a custom fallback", () => {
    expect(safeCallbackUrl(undefined, "/onboarding")).toBe("/onboarding");
  });

  it.each([
    ["absolute https", "https://evil.example/steal"],
    ["absolute http", "http://evil.example"],
    ["protocol relative", "//evil.example"],
    ["backslash protocol relative", "/\\evil.example"],
    ["mixed slash", "/\\/evil.example"],
    ["javascript", "javascript:alert(1)"],
    ["scheme in path", "/redirect:https://evil.example"],
    ["not a path", "evil.example"],
    ["empty", ""],
  ])("rejects %s", (_label, value) => {
    expect(safeCallbackUrl(value)).toBe("/dashboard");
  });

  it("strips control characters and whitespace before validating", () => {
    expect(safeCallbackUrl("/\t/evil.example")).toBe("/dashboard");
    expect(safeCallbackUrl(" /messages ")).toBe("/messages");
  });

  it("rejects an absurdly long path", () => {
    expect(safeCallbackUrl(`/${"a".repeat(600)}`)).toBe("/dashboard");
  });
});

describe("signInHref", () => {
  it("encodes the callback URL", () => {
    expect(signInHref("/dashboard/profile")).toBe(
      "/signin?callbackUrl=%2Fdashboard%2Fprofile",
    );
  });

  it("includes the intent when given", () => {
    expect(signInHref("/onboarding", "provider")).toBe(
      "/signin?callbackUrl=%2Fonboarding&intent=provider",
    );
  });
});
