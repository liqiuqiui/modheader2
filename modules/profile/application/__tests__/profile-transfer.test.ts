import { describe, expect, it } from "vitest";
import { createProfile } from "../../domain/profile-factory";
import {
  createProfileExportDocument,
  parseProfileExportDocument,
  PROFILE_EXPORT_SCHEMA_VERSION,
} from "../profile-transfer";

describe("profile transfer format", () => {
  it("round-trips schema 2 canonical exports", () => {
    const profile = createProfile({
      id: "profile-1",
      title: "Exported",
      backgroundColor: "#2563eb",
    });
    const exported = createProfileExportDocument([profile]);

    expect(PROFILE_EXPORT_SCHEMA_VERSION).toBe(2);
    expect(exported.schemaVersion).toBe(2);
    expect(exported.profiles[0]).not.toHaveProperty("id");
    expect(exported.profiles[0]).not.toHaveProperty("rules");
    expect(exported.profiles[0]).not.toHaveProperty("filters");

    const parsed = parseProfileExportDocument(exported);
    expect(parsed).toHaveLength(1);
    expect(parsed?.[0]).toMatchObject({
      id: "profile-1",
      profileId: "profile-1",
      title: "Exported",
      version: 2,
    });
  });

  it("rejects old and unknown export schemas", () => {
    const profile = createProfile({ title: "Legacy" });

    expect(parseProfileExportDocument({ schemaVersion: 1, profiles: [profile] })).toBeNull();
    expect(parseProfileExportDocument({ profiles: [profile] })).toBeNull();
    expect(
      parseProfileExportDocument({
        schemaVersion: PROFILE_EXPORT_SCHEMA_VERSION,
        profiles: [profile],
        metadata: {},
      }),
    ).toBeNull();
  });

  it("rejects malformed profiles", () => {
    expect(
      parseProfileExportDocument({
        schemaVersion: PROFILE_EXPORT_SCHEMA_VERSION,
        profiles: [{ id: "profile-1" }],
      }),
    ).toBeNull();
  });
});
