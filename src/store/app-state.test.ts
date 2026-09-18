import { describe, expect, it } from "vitest";
import { createProfile } from "../types/profile/profile-factory";
import { createProfileDocument } from "../types/profile/profile-document";
import { profileDataFromDocument, pushProfileHistory } from "./app-state";

describe("profile state slices", () => {
  it("maps document data without mixing history or operation state", () => {
    const profile = createProfile({ title: "Profile 1" });
    const document = createProfileDocument(
      { profiles: [profile], selectedProfileId: profile.id },
      "source",
      7,
      true,
    );
    expect(profileDataFromDocument(document)).toMatchObject({
      profiles: [profile],
      selectedProfileId: profile.id,
      revision: 7,
      sourceId: "source",
      isPaused: true,
    });
  });

  it("records bounded undo history and clears redo history", () => {
    const current = { profiles: [], selectedProfileId: null };
    expect(
      pushProfileHistory(
        current,
        { past: [{ profiles: [], selectedProfileId: null }], future: current ? [current] : [] },
        1,
      ),
    ).toEqual({
      past: [current],
      future: [],
    });
  });
});
