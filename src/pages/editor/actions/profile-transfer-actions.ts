import type { Profile } from "../../../types/profile/profile-model";
import {
  createProfileExportDocument,
  parseProfileExportDocument,
} from "../../../services/profile/profile-transfer";

export function exportProfileFile(profile: Profile): void {
  const blob = new Blob([JSON.stringify(createProfileExportDocument([profile]), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${profile.title.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "profile"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function copyProfileJson(profile: Profile): Promise<void> {
  await navigator.clipboard.writeText(
    JSON.stringify(createProfileExportDocument([profile]), null, 2),
  );
}

export function parseImportedProfiles(value: unknown): Profile[] | null {
  return parseProfileExportDocument(value);
}
