import { describe, expect, it } from "vitest";
import { isContentSecurityPolicyRule } from "../profile-csp";
import { createCspRule, createHeaderRule, createProfile } from "../profile-factory";
import {
  addProfileRule,
  clearProfileRules,
  convertProfileHeader,
  patchProfileRule,
  setProfileRulesEnabled,
} from "../profile-rule-operations";

function profileWithResponseRules() {
  return {
    ...createProfile({ title: "Test", id: "profile-1", backgroundColor: "#2563eb" }),
    headers: [],
    respHeaders: [
      createHeaderRule({ id: "response-1", name: "x-test", value: "1" }),
      createCspRule({ id: "csp-1", value: "default-src 'self'" }),
    ],
  };
}

describe("profile response rule collections", () => {
  it("clears ordinary response headers and CSP directives independently", () => {
    const profile = profileWithResponseRules();

    expect(clearProfileRules(profile, "respHeaders").respHeaders).toEqual([
      expect.objectContaining({ id: "csp-1" }),
    ]);
    expect(clearProfileRules(profile, "csp").respHeaders).toEqual([
      expect.objectContaining({ id: "response-1" }),
    ]);
  });

  it("toggles only the selected virtual response collection", () => {
    const profile = profileWithResponseRules();
    const patched = setProfileRulesEnabled(profile, "csp", false);

    expect(patched.respHeaders.find((rule) => rule.id === "response-1")?.enabled).toBe(true);
    expect(patched.respHeaders.find((rule) => rule.id === "csp-1")?.enabled).toBe(false);
  });

  it("keeps legacy CSP identity stable across value edits and stale conversions", () => {
    const profile = profileWithResponseRules();
    profile.respHeaders[1] = createHeaderRule({
      id: "csp-1",
      name: "Content-Security-Policy",
      value: "default-src 'self'",
    });

    const toggled = setProfileRulesEnabled(profile, "csp", false);
    expect(toggled.respHeaders[1].cspMode).toBeUndefined();

    const patched = patchProfileRule(toggled, "csp", "csp-1", {
      value: "script-src\t'none'",
    });
    expect(patched.respHeaders[1].cspMode).toBeUndefined();

    const patchThenConvert = convertProfileHeader(patched, "csp-1", "headers");
    const convertThenPatch = patchProfileRule(
      convertProfileHeader(toggled, "csp-1", "headers"),
      "csp",
      "csp-1",
      { value: "script-src\t'none'" },
    );
    expect(patchThenConvert.headers.at(-1)).toEqual(convertThenPatch.headers.at(-1));
    expect(patchThenConvert.headers.at(-1)?.cspMode).toBeUndefined();
  });

  it("preserves the raw response rule order while patching a virtual collection", () => {
    const profile = profileWithResponseRules();
    profile.respHeaders.reverse();
    const patched = patchProfileRule(profile, "csp", "csp-1", {
      value: "script-src 'none'",
    });

    expect(patched.respHeaders.map((rule) => rule.id)).toEqual(["csp-1", "response-1"]);
  });

  it("forces rules added through the CSP collection into directive mode", () => {
    const profile = profileWithResponseRules();
    const added = addProfileRule(
      profile,
      "csp",
      createHeaderRule({ id: "csp-2", name: "x-wrong", value: "script-src 'none'" }),
    );

    const rule = added.respHeaders.find((item) => item.id === "csp-2");
    expect(rule && isContentSecurityPolicyRule(rule)).toBe(true);
    expect(rule?.cspMode).toBe("directive");
  });

  it("moves an ordinary response rule into the CSP collection when its name changes", () => {
    const profile = profileWithResponseRules();
    const patched = patchProfileRule(profile, "respHeaders", "response-1", {
      name: "content-security-policy",
      value: "img-src data:",
    });

    expect(patched.respHeaders.filter(isContentSecurityPolicyRule).map((rule) => rule.id)).toEqual([
      "response-1",
      "csp-1",
    ]);
  });

  it("does not allow a CSP patch to change its fixed header identity", () => {
    const profile = profileWithResponseRules();
    const patched = patchProfileRule(profile, "csp", "csp-1", {
      name: "x-not-csp",
      appendMode: "append",
    });

    expect(patched).toBe(profile);
  });

  it("treats CSP as already converted to the response side", () => {
    const profile = profileWithResponseRules();

    expect(convertProfileHeader(profile, "csp-1", "respHeaders")).toBe(profile);
  });
});
