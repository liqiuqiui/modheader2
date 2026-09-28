import { describe, expect, it } from "vitest";
import { getProfileTextColor, isProfileBackgroundColor } from "../profile-appearance";
import { createProfile } from "../profile-factory";
import { applyProfileMetadataPatch } from "../profile-operations";
import { isProfile } from "../profile-validation";

describe("createProfile", () => {
  it("takes the short title from the last grapheme, not the last code unit", () => {
    const emoji = createProfile({ title: "配置🔥", id: "profile-emoji" });

    expect(emoji.shortTitle).toBe("🔥");
    expect(emoji.shortTitle).not.toBe("\ud83d");
  });

  it("derives the text color from the background color", () => {
    const profile = createProfile({
      title: "Light",
      id: "profile-light",
      backgroundColor: "#ffffff",
    });

    expect(profile.textColor).toBe(getProfileTextColor("#ffffff"));
    expect(isProfileBackgroundColor(profile.backgroundColor)).toBe(true);
  });

  it("rejects arguments that would not survive validation", () => {
    expect(() =>
      createProfile({ title: "Bad", id: "profile-bad", backgroundColor: "red" }),
    ).toThrow(/background color/);
    expect(() => createProfile({ title: "Bad", id: "" })).toThrow(/id/);
    expect(() => createProfile({ title: "" })).toThrow(/title/);
  });

  it("profiles a document that passes validation", () => {
    expect(isProfile(createProfile({ title: "Valid", id: "profile-valid" }))).toBe(true);
  });
});

describe("applyProfileMetadataPatch", () => {
  it("recomputes the short title when renaming", () => {
    const profile = createProfile({ title: "Old🚀", id: "profile-rename" });
    const renamed = applyProfileMetadataPatch(profile, { title: "New🔥" });

    expect(renamed.title).toBe("New🔥");
    expect(renamed.shortTitle).toBe("🔥");
  });

  it("honours the metadata fields it accepts", () => {
    const profile = createProfile({ title: "Meta", id: "profile-meta" });
    const patched = applyProfileMetadataPatch(profile, {
      shortTitle: "M",
      textColor: "#000000",
      hideComment: false,
    });

    expect(patched).toMatchObject({ shortTitle: "M", textColor: "#000000", hideComment: false });
  });

  it("ignores unknown and invalid fields", () => {
    const profile = createProfile({ title: "Meta", id: "profile-meta" });

    expect(applyProfileMetadataPatch(profile, { backgroundColor: "red" })).toBe(profile);
    expect(applyProfileMetadataPatch(profile, { unknown: 1 })).toBe(profile);
  });
});
