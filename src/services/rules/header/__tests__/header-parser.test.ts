import { describe, expect, it } from "vitest";
import {
  createHeaderRule,
  isContentSecurityPolicyHeaderName,
  normalizeHeaderRule,
  parseHeaderRule,
} from "../header-parser";

describe("header parser", () => {
  it("creates a valid empty rule", () => {
    expect(createHeaderRule()).toMatchObject({
      enabled: true,
      name: "",
      value: "",
      appendMode: "override",
      sendEmptyHeader: false,
    });
  });

  it("normalizes user-entered fields", () => {
    expect(
      normalizeHeaderRule({ ...createHeaderRule(), name: "  X-Test ", comment: " note " }),
    ).toMatchObject({
      name: "X-Test",
      comment: "note",
    });
  });

  it("rejects malformed input", () => {
    expect(parseHeaderRule({ name: "x" })).toBeNull();
  });

  it("recognizes CSP header names case-insensitively", () => {
    expect(isContentSecurityPolicyHeaderName(" content-security-policy ")).toBe(true);
  });
});
