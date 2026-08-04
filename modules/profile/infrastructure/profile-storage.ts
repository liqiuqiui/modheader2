import { storage } from "wxt/utils/storage";
import { createEmptyProfileDocument, type ProfileDocument } from "../domain/profile-document";
import { isProfileDocument } from "../domain/profile-validation";

export type { ProfileDocument } from "../domain/profile-document";

export const PROFILE_STATE_STORAGE_KEY = "local:profile-state-v2" as const;

export const profileStateStorage = storage.defineItem<ProfileDocument>(PROFILE_STATE_STORAGE_KEY, {
  defaultValue: createEmptyProfileDocument(),
});

export async function readStoredProfileDocument(): Promise<ProfileDocument> {
  const value = await profileStateStorage.getValue();
  return isProfileDocument(value) ? value : createEmptyProfileDocument();
}

export async function writeStoredProfileDocument(document: ProfileDocument): Promise<void> {
  if (!isProfileDocument(document)) {
    throw new Error("Refusing to persist an invalid profile document");
  }
  await profileStateStorage.setValue(document);
}
