import type { Profile, ProfileMetadataPatch } from "./profile-model";
import { getProfileShortTitle, getProfileTextColor } from "./profile-appearance";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function profileHasEntityId(profile: Profile, entityId: string): boolean {
  return (
    Object.hasOwn(profile.filters.byId, entityId) ||
    [
      ...profile.headers,
      ...profile.respHeaders,
      ...profile.cookies,
      ...profile.urlReplacements,
    ].some((entity) => entity.id === entityId)
  );
}

export function applyProfileMetadataPatch(profile: Profile, patch: unknown): Profile {
  if (!isRecord(patch)) return profile;
  const changes: ProfileMetadataPatch = {};
  if (typeof patch.title === "string" && patch.title !== profile.title) {
    changes.title = patch.title;
  }
  if (
    typeof patch.backgroundColor === "string" &&
    patch.backgroundColor.length > 0 &&
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
  if (typeof patch.hideComment === "boolean" && patch.hideComment !== profile.hideComment) {
    changes.hideComment = patch.hideComment;
  }
  if (Object.keys(changes).length === 0) return profile;
  const next = { ...profile, ...changes };
  if (changes.title !== undefined) next.shortTitle = getProfileShortTitle(changes.title);
  if (changes.backgroundColor !== undefined) {
    next.textColor = getProfileTextColor(changes.backgroundColor);
  }
  return next;
}
