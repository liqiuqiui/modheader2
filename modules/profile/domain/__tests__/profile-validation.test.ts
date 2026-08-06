import { describe, expect, it } from "vitest";
import {
  createEmptyProfileDocument,
  createInitialProfileDocument,
  PROFILE_DOCUMENT_SCHEMA_VERSION,
  withPreferredProfileSelection,
} from "../profile-document";
import { createCspRule, createHeaderRule, createProfile } from "../profile-factory";
import { createProfileFilter } from "../profile-filter";
import type { Profile } from "../profile-model";
import { isProfile, isProfileDocument, isProfileState } from "../profile-validation";

function emptyProfile(id = "profile-1"): Profile {
  const profile = createProfile({ title: "Test", id, backgroundColor: "#2563eb" });
  return {
    ...profile,
    rules: { ...profile.rules, requestHeaders: [] },
  };
}

describe("Profile schema validation", () => {
  it("accepts the new nested rule model and ordered filter array", () => {
    const profile = emptyProfile();
    profile.rules.csp = [createCspRule({ id: "csp-1", directive: "default-src", value: "'self'" })];
    profile.filters = [
      createProfileFilter({ id: "filter-1", kind: "urlPattern", mode: "include" }),
    ];

    expect(isProfile(profile)).toBe(true);
    expect(isProfileDocument(createInitialProfileDocument(profile, "test", 1))).toBe(true);
  });

  it("rejects unknown profile fields", () => {
    const profile = emptyProfile() as unknown as Record<string, unknown>;
    profile.derivedTitle = "T";
    expect(isProfile(profile)).toBe(false);

    delete profile.derivedTitle;
    profile.flatRules = [];
    expect(isProfile(profile)).toBe(false);
  });

  it("requires a hex background color", () => {
    const profile = emptyProfile();

    expect(isProfile({ ...profile, backgroundColor: "white" })).toBe(false);
    expect(isProfile({ ...profile, backgroundColor: "#fff" })).toBe(true);
    expect(isProfile({ ...profile, backgroundColor: "#2563eb" })).toBe(true);
  });

  it("requires every nested rule collection exactly once", () => {
    const profile = emptyProfile();
    const { redirects: _redirects, ...missingRedirects } = profile.rules;

    expect(isProfile({ ...profile, rules: missingRedirects })).toBe(false);
    expect(isProfile({ ...profile, rules: { ...profile.rules, extra: [] } })).toBe(false);
  });

  it("rejects CSP headers in responseHeaders and accepts them in the dedicated collection", () => {
    const profile = emptyProfile();
    profile.rules.responseHeaders = [
      createHeaderRule({
        id: "csp-1",
        name: "Content-Security-Policy",
        value: "default-src 'self'",
      }),
    ];
    expect(isProfile(profile)).toBe(false);

    profile.rules.responseHeaders = [];
    profile.rules.csp = [createCspRule({ id: "csp-1", directive: "default-src", value: "'self'" })];
    expect(isProfile(profile)).toBe(true);
  });

  it("rejects profile-wide entity ID collisions", () => {
    const profile = emptyProfile();
    profile.rules.requestHeaders = [
      createHeaderRule({ id: "shared-id", name: "x-test", value: "1" }),
    ];
    profile.filters = [createProfileFilter({ id: "shared-id", kind: "method" })];

    expect(isProfile(profile)).toBe(false);
  });

  it("requires filters to be a valid rule array", () => {
    const profile = emptyProfile();
    profile.filters = [{ ...createProfileFilter({ id: "tab-filter", kind: "tab" }), value: -1 }];
    expect(isProfile(profile)).toBe(false);

    expect(isProfile({ ...emptyProfile(), filters: {} })).toBe(false);
  });

  it("validates state selection and unique profile IDs", () => {
    const first = emptyProfile("profile-1");
    const second = emptyProfile("profile-2");

    expect(isProfileState({ profiles: [first, second], selectedProfileId: first.id })).toBe(true);
    expect(isProfileState({ profiles: [first, first], selectedProfileId: first.id })).toBe(false);
    expect(isProfileState({ profiles: [first], selectedProfileId: "missing" })).toBe(false);
    expect(isProfileState({ profiles: [], selectedProfileId: null })).toBe(true);
  });

  it("accepts only the current document schema", () => {
    const document = createEmptyProfileDocument();
    expect(isProfileDocument(document)).toBe(true);
    expect(
      isProfileDocument({
        ...document,
        schemaVersion: PROFILE_DOCUMENT_SCHEMA_VERSION + 1,
      }),
    ).toBe(false);
  });

  it("preserves the active profile across history targets when it still exists", () => {
    const first = emptyProfile("profile-1");
    const second = emptyProfile("profile-2");
    const state = { profiles: [first, second], selectedProfileId: first.id };

    expect(withPreferredProfileSelection(state, second.id).selectedProfileId).toBe(second.id);
    expect(withPreferredProfileSelection(state, "missing")).toBe(state);
  });
});
