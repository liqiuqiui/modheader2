import { describe, expect, it } from "vitest";
import { createCspRule, createHeaderRule } from "../profile-factory";
import {
  createContentSecurityPolicyValue,
  cspRuleFromHeaderRule,
  headerRuleFromCspRule,
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

  it("splits and joins a directive and its value", () => {
    expect(splitCspDirective("script-src 'self' https://cdn.example")).toEqual({
      directive: "script-src",
      value: "'self' https://cdn.example",
    });
    expect(splitCspDirective("script-src\t'self'")).toEqual({
      directive: "script-src",
      value: "'self'",
    });
    expect(joinCspDirective(" script-src ", "  'self'")).toBe("script-src 'self'");
    expect(joinCspDirective("", "'self'")).toBe("'self'");
  });

  it("converts between a CSP header and a dedicated CSP rule without changing identity", () => {
    const header = createHeaderRule({
      id: "csp-1",
      enabled: false,
      name: "Content-Security-Policy",
      value: "default-src 'self'",
      comment: "keep",
    });
    const csp = cspRuleFromHeaderRule(header);

    expect(csp).toEqual({
      id: "csp-1",
      enabled: false,
      directive: "default-src",
      value: "'self'",
      comment: "keep",
    });
    expect(headerRuleFromCspRule(csp)).toEqual({
      id: "csp-1",
      enabled: false,
      name: "Content-Security-Policy",
      value: "default-src 'self'",
      comment: "keep",
      appendMode: "override",
      sendEmptyHeader: false,
    });
  });

  it("combines only enabled non-empty directives into one header value", () => {
    expect(
      createContentSecurityPolicyValue([
        createCspRule({ directive: "default-src", value: "'self';" }),
        createCspRule({ directive: "script-src", value: "'none'" }),
        createCspRule({ directive: "img-src", value: "data:", enabled: false }),
        createCspRule({ value: "'draft-without-directive'" }),
      ]),
    ).toBe("default-src 'self'; script-src 'none'");
  });

  it("drops separator-only directive drafts", () => {
    expect(createContentSecurityPolicyValue([createCspRule({ directive: ";;;" })])).toBe("");
  });
});
