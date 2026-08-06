import { isEmpty } from "lodash-es";
import type { Profile, ProfileMetadataPatch } from "./profile-model";
import { getProfileShortTitle, getProfileTextColor } from "./profile-appearance";
import { isRecord } from "./profile-guards";

export function profileEntityIds(profile: Profile): string[] {
  return [
    ...profile.headers.map((entity) => entity.id),
    ...profile.respHeaders.map((entity) => entity.id),
    ...profile.cookies.map((entity) => entity.id),
    ...profile.urlReplacements.map((entity) => entity.id),
    ...profile.filters.order,
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
  if (isEmpty(changes)) return profile;
  const next = { ...profile, ...changes };
  if (changes.title !== undefined) next.shortTitle = getProfileShortTitle(changes.title);
  if (changes.backgroundColor !== undefined) {
    next.textColor = getProfileTextColor(changes.backgroundColor);
  }
  return next;
}
