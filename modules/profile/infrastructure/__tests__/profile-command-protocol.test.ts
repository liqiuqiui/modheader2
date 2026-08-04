import { describe, expect, it } from "vitest";
import { createCspRule, createHeaderRule } from "../../domain/profile-factory";
import { isProfileCommandMessage, PROFILE_COMMAND_CHANNEL } from "../profile-command-protocol";

function commandMessage(command: unknown): unknown {
  return {
    channel: PROFILE_COMMAND_CHANNEL,
    clientId: "client-a",
    command,
  };
}

describe("profile command protocol", () => {
  it.each([
    {
      type: "clearRules",
      profileId: "profile-1",
      collection: "headers",
    },
    {
      type: "clearFilters",
      profileId: "profile-1",
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
          collection: "headers",
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

  it("accepts CSP as a virtual response rule collection", () => {
    expect(
      isProfileCommandMessage(
        commandMessage({
          type: "addRule",
          profileId: "profile-1",
          collection: "csp",
          rule: createCspRule({ id: "csp-1", value: "default-src 'self'" }),
        }),
      ),
    ).toBe(true);
    expect(
      isProfileCommandMessage(
        commandMessage({
          type: "clearRules",
          profileId: "profile-1",
          collection: "csp",
          expectedRevision: 3,
        }),
      ),
    ).toBe(true);
  });

  it("rejects CSP payloads and patches that can escape the virtual collection", () => {
    expect(
      isProfileCommandMessage(
        commandMessage({
          type: "addRule",
          profileId: "profile-1",
          collection: "csp",
          rule: createHeaderRule({
            id: "legacy-csp",
            name: "Content-Security-Policy",
          }),
        }),
      ),
    ).toBe(false);
    expect(
      isProfileCommandMessage(
        commandMessage({
          type: "addRule",
          profileId: "profile-1",
          collection: "csp",
          rule: { ...createCspRule({ id: "csp-1" }), name: "x-not-csp" },
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
});
