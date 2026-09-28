import { isRecord } from "./profile-guards";
import { getProfileShortTitle, isProfileBackgroundColor } from "./profile-appearance";
import type { Profile, ProfileMetadataPatch } from "./profile-model";

export function profileEntityIds(profile: Profile): string[] {
  return [
    ...profile.rules.requestHeaders.map((entity) => entity.id),
    ...profile.rules.responseHeaders.map((entity) => entity.id),
    ...profile.rules.csp.map((entity) => entity.id),
    ...profile.rules.cookies.map((entity) => entity.id),
    ...profile.rules.redirects.map((entity) => entity.id),
    ...profile.filters.map((entity) => entity.id),
  ];
}

export function profileHasEntityId(profile: Profile, entityId: string): boolean {
  return profileEntityIds(profile).includes(entityId);
}

export function applyProfileMetadataPatch(profile: Profile, patch: unknown): Profile {
  if (!isRecord(patch)) return profile;

  const changes: ProfileMetadataPatch = {};
  if (typeof patch.title === "string" && patch.title !== profile.title) {
    changes.title = patch.title;
  }
  if (typeof patch.shortTitle === "string" && patch.shortTitle !== profile.shortTitle) {
    changes.shortTitle = patch.shortTitle;
  }
  if (
    isProfileBackgroundColor(patch.backgroundColor) &&
    patch.backgroundColor !== profile.backgroundColor
  ) {
    changes.backgroundColor = patch.backgroundColor;
  }
  if (typeof patch.textColor === "string" && patch.textColor !== profile.textColor) {
    changes.textColor = patch.textColor;
  }
  if (typeof patch.hideComment === "boolean" && patch.hideComment !== profile.hideComment) {
    changes.hideComment = patch.hideComment;
  }
  if (typeof patch.enabled === "boolean" && patch.enabled !== profile.enabled) {
    changes.enabled = patch.enabled;
  }
  if (typeof patch.paused === "boolean" && patch.paused !== profile.paused) {
    changes.paused = patch.paused;
  }
  // Renaming without an explicit short title would otherwise leave the badge
  // showing the first character of a name that no longer exists.
  if (changes.title !== undefined && changes.shortTitle === undefined) {
    changes.shortTitle = getProfileShortTitle(changes.title);
  }

  return Object.keys(changes).length === 0 ? profile : { ...profile, ...changes };
}
