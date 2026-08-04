import { describe, expect, it } from "vitest";
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
});
