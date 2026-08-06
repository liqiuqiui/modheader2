import { describe, expect, it } from "vitest";
import { createProfile } from "../../domain/profile-factory";
import {
  createProfileExportDocument,
  parseProfileExportDocument,
  PROFILE_EXPORT_SCHEMA_VERSION,
} from "../profile-transfer";

describe("profile transfer format", () => {
  it("round-trips schema 1 exports", () => {
    const profile = createProfile({
      id: "profile-1",
      title: "Exported",
      backgroundColor: "#2563eb",
    });
    const exported = createProfileExportDocument([profile]);

    expect(PROFILE_EXPORT_SCHEMA_VERSION).toBe(1);
    expect(exported).toEqual({ schemaVersion: 1, profiles: [profile] });
    expect(parseProfileExportDocument(exported)).toEqual([profile]);
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
