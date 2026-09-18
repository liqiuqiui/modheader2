import { describe, expect, it } from "vitest";
import { createCspDirectiveValue, createCspRule, splitCspDirective } from "../csp-parser";

describe("csp parser", () => {
  it("creates and joins directives", () => {
    const rule = createCspRule({ directive: "script-src", value: "'self';" });
    expect(createCspDirectiveValue(rule)).toBe("script-src 'self'");
  });

  it("splits a directive value", () => {
    expect(splitCspDirective("script-src 'self'")).toEqual({
      directive: "script-src",
      value: "'self'",
    });
  });
});
