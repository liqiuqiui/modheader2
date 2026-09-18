import { describe, expect, it } from "vitest";
import { createProfile } from "../../../types/profile/profile-factory";
import {
  createProfileExportDocument,
  parseProfileExportDocument,
  PROFILE_EXPORT_SCHEMA_VERSION,
} from "../profile-transfer";

describe("profile transfer format", () => {
  it("round-trips the current profile export schema", () => {
    const profile = createProfile({
      id: "profile-1",
      title: "Exported",
      backgroundColor: "#2563eb",
    });
    const exported = createProfileExportDocument([profile]);

    expect(PROFILE_EXPORT_SCHEMA_VERSION).toBe(1);
    expect(exported.schemaVersion).toBe(1);
    expect(exported.profiles[0]).toHaveProperty("id", "profile-1");
    expect(exported.profiles[0]).toHaveProperty("rules");
    expect(exported.profiles[0]).toHaveProperty("filters");

    const parsed = parseProfileExportDocument(exported);
    expect(parsed).toHaveLength(1);
    expect(parsed?.[0]).toMatchObject({
      id: "profile-1",
      title: "Exported",
      version: 1,
    });
  });

  it("rejects old and unknown export schemas", () => {
    const profile = createProfile({ title: "Legacy" });

    expect(parseProfileExportDocument({ schemaVersion: 2, profiles: [profile] })).toBeNull();
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
