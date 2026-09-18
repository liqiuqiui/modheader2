import { describe, expect, it } from "vitest";
import {
  createCspRule,
  createHeaderRule,
  createProfile,
} from "../../../types/profile/profile-factory";
import type { Profile } from "../../../types/profile/profile-model";
import {
  addProfileRule,
  clearProfileRules,
  cloneProfileRule,
  convertProfileHeader,
  deleteProfileRule,
  patchProfileRule,
  setProfileRulesEnabled,
  sortProfileRuleCollections,
} from "../rule-operations";

function profileWithRules(): Profile {
  const profile = createProfile({ title: "Test", id: "profile-1", backgroundColor: "#2563eb" });
  return {
    ...profile,
    rules: {
      ...profile.rules,
      requestHeaders: [],
      responseHeaders: [createHeaderRule({ id: "response-1", name: "x-test", value: "1" })],
      csp: [createCspRule({ id: "csp-1", directive: "default-src", value: "'self'" })],
    },
  };
}

describe("profile rule collections", () => {
  it("keeps response headers and CSP directives in independent collections", () => {
    const profile = profileWithRules();

    expect(clearProfileRules(profile, "responseHeaders").rules).toMatchObject({
      responseHeaders: [],
      csp: [expect.objectContaining({ id: "csp-1" })],
    });
    expect(clearProfileRules(profile, "csp").rules).toMatchObject({
      responseHeaders: [expect.objectContaining({ id: "response-1" })],
      csp: [],
    });
  });

  it("toggles only the selected collection", () => {
    const profile = profileWithRules();
    const patched = setProfileRulesEnabled(profile, "csp", false);

    expect(patched.rules.responseHeaders[0].enabled).toBe(true);
    expect(patched.rules.csp[0].enabled).toBe(false);
  });

  it("moves a CSP response header into the dedicated collection when added", () => {
    const profile = profileWithRules();
    const added = addProfileRule(
      profile,
      "responseHeaders",
      createHeaderRule({
        id: "csp-2",
        enabled: false,
        name: " content-security-policy ",
        value: "script-src 'none'",
        comment: "keep",
      }),
    );

    expect(added.rules.responseHeaders.map((rule) => rule.id)).toEqual(["response-1"]);
    expect(added.rules.csp.at(-1)).toEqual({
      id: "csp-2",
      enabled: false,
      directive: "script-src",
      value: "'none'",
      comment: "keep",
    });
  });

  it("moves an existing response header into CSP when its name is patched", () => {
    const profile = profileWithRules();
    const patched = patchProfileRule(profile, "responseHeaders", "response-1", {
      name: "Content-Security-Policy",
      value: "img-src data:",
    });

    expect(patched.rules.responseHeaders).toEqual([]);
    expect(patched.rules.csp.map((rule) => rule.id)).toEqual(["csp-1", "response-1"]);
    expect(patched.rules.csp[1]).toMatchObject({ directive: "img-src", value: "data:" });
  });

  it("interprets a stale response value patch after the rule moved into CSP", () => {
    const profile = patchProfileRule(profileWithRules(), "responseHeaders", "response-1", {
      name: "Content-Security-Policy",
      value: "default-src 'self'",
    });
    const patched = patchProfileRule(profile, "responseHeaders", "response-1", {
      value: "script-src 'none'",
      comment: "updated",
    });

    expect(patched.rules.csp.find((rule) => rule.id === "response-1")).toMatchObject({
      directive: "script-src",
      value: "'none'",
      comment: "updated",
    });
  });

  it("patches dedicated CSP fields without accepting header-only fields", () => {
    const profile = profileWithRules();
    const patched = patchProfileRule(profile, "csp", "csp-1", {
      directive: "script-src",
      value: "'none'",
      name: "x-ignored",
      appendMode: "append",
    });

    expect(patched.rules.csp[0]).toEqual({
      id: "csp-1",
      enabled: true,
      directive: "script-src",
      value: "'none'",
      comment: "",
    });
  });

  it("converts ordinary and CSP headers between request and response sides", () => {
    const responseToRequest = convertProfileHeader(
      profileWithRules(),
      "response-1",
      "requestHeaders",
    );
    expect(responseToRequest.rules.responseHeaders).toEqual([]);
    expect(responseToRequest.rules.requestHeaders.at(-1)?.id).toBe("response-1");

    const cspToRequest = convertProfileHeader(profileWithRules(), "csp-1", "requestHeaders");
    expect(cspToRequest.rules.csp).toEqual([]);
    expect(cspToRequest.rules.requestHeaders.at(-1)).toMatchObject({
      id: "csp-1",
      name: "Content-Security-Policy",
      value: "default-src 'self'",
    });

    const backToResponse = convertProfileHeader(cspToRequest, "csp-1", "responseHeaders");
    expect(backToResponse.rules.responseHeaders).toEqual(profileWithRules().rules.responseHeaders);
    expect(backToResponse.rules.csp.at(-1)).toMatchObject({
      id: "csp-1",
      directive: "default-src",
      value: "'self'",
    });
  });

  it("clones and deletes rules while enforcing profile-wide ID uniqueness", () => {
    const profile = profileWithRules();
    const cloned = cloneProfileRule(profile, "csp", "csp-1", "csp-copy");

    expect(cloned.rules.csp.map((rule) => rule.id)).toEqual(["csp-1", "csp-copy"]);
    expect(cloneProfileRule(cloned, "csp", "csp-1", "response-1")).toBe(cloned);
    expect(deleteProfileRule(cloned, "csp", "csp-copy").rules.csp).toHaveLength(1);
  });

  it("sorts request and response headers without rebuilding an already sorted profile", () => {
    const profile = profileWithRules();
    profile.rules.requestHeaders = [
      createHeaderRule({ id: "b", name: "x-b" }),
      createHeaderRule({ id: "a", name: "x-a" }),
    ];
    const sorted = sortProfileRuleCollections(profile);

    expect(sorted.rules.requestHeaders.map((rule) => rule.id)).toEqual(["a", "b"]);
    expect(sortProfileRuleCollections(sorted)).toBe(sorted);
  });
});
