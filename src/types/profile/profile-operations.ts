import { isRecord } from "./profile-guards";
import { isProfileBackgroundColor } from "./profile-appearance";
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
  if (
    isProfileBackgroundColor(patch.backgroundColor) &&
    patch.backgroundColor !== profile.backgroundColor
  ) {
    changes.backgroundColor = patch.backgroundColor;
  }
  if (typeof patch.enabled === "boolean" && patch.enabled !== profile.enabled) {
    changes.enabled = patch.enabled;
  }
  if (typeof patch.paused === "boolean" && patch.paused !== profile.paused) {
    changes.paused = patch.paused;
  }

  return Object.keys(changes).length === 0 ? profile : { ...profile, ...changes };
}
