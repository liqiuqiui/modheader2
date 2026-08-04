import { describe, expect, it } from "vitest";
import { createCspRule, createHeaderRule } from "../profile-factory";
import {
  createContentSecurityPolicyValue,
  isContentSecurityPolicyHeaderName,
  joinCspDirective,
  splitCspDirective,
} from "../profile-csp";

describe("Content-Security-Policy helpers", () => {
  it("recognizes the response header name without depending on casing or padding", () => {
    expect(isContentSecurityPolicyHeaderName("Content-Security-Policy")).toBe(true);
    expect(isContentSecurityPolicyHeaderName(" content-security-policy ")).toBe(true);
    expect(isContentSecurityPolicyHeaderName("Content-Security-Policy-Report-Only")).toBe(false);
  });

  it("splits and joins directive fields", () => {
    expect(splitCspDirective("script-src 'self' https://cdn.example")).toEqual({
      directive: "script-src",
      directiveValue: "'self' https://cdn.example",
    });
    const encoded = joinCspDirective(" script-src ", "  'self'");
    expect(encoded).toBe("script-src\t'self'");
    expect(splitCspDirective(encoded)).toEqual({
      directive: "script-src",
      directiveValue: "'self'",
    });
    expect(splitCspDirective(joinCspDirective("", "'self'"))).toEqual({
      directive: "",
      directiveValue: "'self'",
    });
  });

  it("combines only enabled non-empty directives into one header value", () => {
    expect(
      createContentSecurityPolicyValue([
        createHeaderRule({
          name: "Content-Security-Policy",
          value: "legacy-src 'none'",
        }),
        createCspRule({ value: "default-src 'self';" }),
        createCspRule({ value: "script-src 'none'" }),
        createCspRule({ value: "img-src data:", enabled: false }),
        createCspRule(),
      ]),
    ).toBe("default-src 'self'; script-src 'none'");
  });

  it("drops separator-only directive drafts", () => {
    expect(createContentSecurityPolicyValue([createCspRule({ value: ";;;" })])).toBe("");
  });
});
