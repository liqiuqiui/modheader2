import { describe, expect, it } from "vitest";
import { createInitialProfileDocument } from "../../../types/profile/profile-document";
import {
  createCspRule,
  createHeaderRule,
  createProfile,
} from "../../../types/profile/profile-factory";
import {
  isProfileCommandMessage,
  parseProfileCommandResponse,
  PROFILE_COMMAND_CHANNEL,
} from "../profile-command-protocol";

function commandMessage(command: unknown): unknown {
  return {
    channel: PROFILE_COMMAND_CHANNEL,
    clientId: "client-a",
    command,
  };
}

describe("profile command protocol", () => {
  it("uses the new command channel", () => {
    expect(PROFILE_COMMAND_CHANNEL).toBe("profile-operation-command");
    expect(
      isProfileCommandMessage({
        ...(commandMessage({ type: "selectProfile", profileId: "profile-1" }) as object),
        extra: true,
      }),
    ).toBe(false);
    expect(
      isProfileCommandMessage(
        commandMessage({ type: "selectProfile", profileId: "profile-1", extra: true }),
      ),
    ).toBe(false);
  });

  it.each([
    {
      type: "clearRules",
      profileId: "profile-1",
      collection: "requestHeaders",
    },
    {
      type: "clearFilters",
      profileId: "profile-1",
    },
    {
      type: "replaceState",
      state: { profiles: [], selectedProfileId: null },
    },
  ])("rejects $type without expectedRevision", (command) => {
    expect(isProfileCommandMessage(commandMessage(command))).toBe(false);
  });

  it("rejects an invalid rule payload", () => {
    expect(
      isProfileCommandMessage(
        commandMessage({
          type: "addRule",
          profileId: "profile-1",
          collection: "requestHeaders",
          rule: {
            id: "header-1",
            enabled: true,
            name: "x-test",
            value: "value",
            comment: "",
            appendMode: "override",
          },
        }),
      ),
    ).toBe(false);
  });

  it("rejects an invalid filter payload", () => {
    expect(
      isProfileCommandMessage(
        commandMessage({
          type: "addFilter",
          profileId: "profile-1",
          filter: {
            id: "filter-1",
            enabled: true,
            kind: "method",
            mode: "include",
            value: "trace",
            comment: "",
          },
        }),
      ),
    ).toBe(false);
  });

  it("accepts dedicated CSP rules and response headers that can be converted to CSP", () => {
    expect(
      isProfileCommandMessage(
        commandMessage({
          type: "addRule",
          profileId: "profile-1",
          collection: "csp",
          rule: createCspRule({ id: "csp-1", directive: "default-src", value: "'self'" }),
        }),
      ),
    ).toBe(true);
    expect(
      isProfileCommandMessage(
        commandMessage({
          type: "addRule",
          profileId: "profile-1",
          collection: "responseHeaders",
          rule: createHeaderRule({
            id: "response-csp",
            name: "Content-Security-Policy",
            value: "default-src 'self'",
          }),
        }),
      ),
    ).toBe(true);
  });

  it("keeps CSP and header patch shapes separate", () => {
    expect(
      isProfileCommandMessage(
        commandMessage({
          type: "addRule",
          profileId: "profile-1",
          collection: "csp",
          rule: createHeaderRule({
            id: "header-shaped-csp",
            name: "Content-Security-Policy",
          }),
        }),
      ),
    ).toBe(false);
    expect(
      isProfileCommandMessage(
        commandMessage({
          type: "patchRule",
          profileId: "profile-1",
          collection: "csp",
          ruleId: "csp-1",
          patch: { name: "x-not-csp" },
        }),
      ),
    ).toBe(false);
  });

  it("requires a replacement profile for deletion commands", () => {
    expect(
      isProfileCommandMessage(commandMessage({ type: "deleteProfile", profileId: "profile-1" })),
    ).toBe(false);
  });

  it("accepts schema 1 responses and rejects old schemas", () => {
    const document = createInitialProfileDocument(
      createProfile({ id: "profile-1", title: "Current" }),
      "background",
      3,
    );

    expect(parseProfileCommandResponse({ ok: true, document })).toEqual({ ok: true, document });
    expect(parseProfileCommandResponse({ ok: true, document, extra: true })).toBeNull();
    expect(
      parseProfileCommandResponse({
        ok: true,
        document: { ...document, schemaVersion: 2 },
      }),
    ).toBeNull();
  });
});
