import { describe, expect, it } from "vitest";
import { resolveProfileSwitchTargetId } from "../profile-switch-command";
import { createProfile } from "../../../types/profile/profile-factory";
import type { Profile } from "../../../types/profile/profile-model";

function profiles(...titles: string[]): Profile[] {
  return titles.map((title, index) => createProfile({ title, id: `profile-${index + 1}` }));
}

describe("resolveProfileSwitchTargetId", () => {
  it("treats the command suffix as a 1-based position", () => {
    const list = profiles("Zebra", "Alpha", "Beta");

    // Regression guard: `_1` must be the first profile, not `profiles[1]`.
    expect(resolveProfileSwitchTargetId("switch_to_profile_1", list)).toBe("profile-1");
    expect(resolveProfileSwitchTargetId("switch_to_profile_2", list)).toBe("profile-2");
    expect(resolveProfileSwitchTargetId("switch_to_profile_3", list)).toBe("profile-3");
  });

  it("follows the current order rather than a fixed profile identity", () => {
    const list = profiles("Zebra", "Alpha", "Beta");
    const sorted = [...list].sort((left, right) => left.title.localeCompare(right.title));

    // Position-based commands intentionally track list order, so a re-sort moves
    // which profile a shortcut targets. Pinned here so the tradeoff stays visible.
    expect(resolveProfileSwitchTargetId("switch_to_profile_1", sorted)).toBe("profile-2");
  });

  it("ignores a position beyond the last profile", () => {
    const list = profiles("Alpha", "Beta");

    expect(resolveProfileSwitchTargetId("switch_to_profile_3", list)).toBeUndefined();
  });

  it("rejects position zero, which has no 1-based counterpart", () => {
    const list = profiles("Alpha", "Beta");

    expect(resolveProfileSwitchTargetId("switch_to_profile_0", list)).toBeUndefined();
  });

  it("rejects non-numeric and partially numeric suffixes", () => {
    const list = profiles("Alpha", "Beta");

    // `Number.parseInt("1abc")` is 1 — a bare parseInt would wrongly match.
    expect(resolveProfileSwitchTargetId("switch_to_profile_1abc", list)).toBeUndefined();
    expect(resolveProfileSwitchTargetId("switch_to_profile_x", list)).toBeUndefined();
    expect(resolveProfileSwitchTargetId("switch_to_profile_", list)).toBeUndefined();
    expect(resolveProfileSwitchTargetId("switch_to_profile_-1", list)).toBeUndefined();
    expect(resolveProfileSwitchTargetId("switch_to_profile_1.5", list)).toBeUndefined();
  });

  it("ignores commands that are not profile switches", () => {
    const list = profiles("Alpha", "Beta");

    expect(resolveProfileSwitchTargetId("toggle_pause", list)).toBeUndefined();
    expect(resolveProfileSwitchTargetId("wxt:reload-extension", list)).toBeUndefined();
    expect(resolveProfileSwitchTargetId("", list)).toBeUndefined();
  });

  it("returns undefined when there are no profiles", () => {
    expect(resolveProfileSwitchTargetId("switch_to_profile_1", [])).toBeUndefined();
  });
});
