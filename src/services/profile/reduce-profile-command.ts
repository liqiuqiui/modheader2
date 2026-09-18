import { arrayMoveImmutable } from "array-move";
import { isNonEmptyString, isNonNegativeInteger } from "../../types/profile/profile-guards";
import { isProfileBackgroundColor } from "../../types/profile/profile-appearance";
import {
  addProfileFilter,
  changeProfileFilterKind,
  clearProfileFilters,
  deleteProfileFilter,
  patchProfileFilter,
  reorderProfileFilters,
  setProfileFiltersEnabled,
  sortProfileFilters,
} from "../rules/filter/filter-collection-operations";
import {
  createInitialProfileDocument,
  createProfileDocument,
  type ProfileDocument,
  type ProfileState,
} from "../../types/profile/profile-document";
import type { Profile } from "../../types/profile/profile-model";
import { applyProfileMetadataPatch } from "../../types/profile/profile-operations";
import {
  addProfileRule,
  clearProfileRules,
  cloneProfileRule,
  convertProfileHeader,
  deleteProfileRule,
  patchProfileRule,
  setProfileRulesEnabled,
  sortProfileRuleCollections,
} from "../rules/rule-operations";
import { isProfile, isProfileState } from "../../types/profile/profile-validation";
import { expectedProfileCommandRevision, type ProfileCommand } from "./profile-command";

export type ProfileCommandResult =
  | { status: "applied"; document: ProfileDocument }
  | { status: "noop"; document: ProfileDocument }
  | {
      status: "revision-conflict";
      document: ProfileDocument;
      expected: number;
      actual: number;
    };

export function isProfileCommandRevisionConflict(
  result: ProfileCommandResult,
): result is Extract<ProfileCommandResult, { status: "revision-conflict" }> {
  return result.status === "revision-conflict";
}

function nextDocument(
  current: ProfileDocument,
  state: ProfileState,
  sourceId: string,
): ProfileDocument {
  return createProfileDocument(state, sourceId, current.revision + 1, current.isPaused);
}

function replaceProfile(
  current: ProfileDocument,
  profileId: string,
  sourceId: string,
  update: (profile: Profile) => Profile,
): ProfileDocument {
  const index = current.state.profiles.findIndex((profile) => profile.id === profileId);
  if (index < 0) return current;
  const profile = current.state.profiles[index];
  const nextProfile = update(profile);
  if (nextProfile === profile || !isProfile(nextProfile)) return current;
  const profiles = [...current.state.profiles];
  profiles[index] = nextProfile;
  return nextDocument(current, { ...current.state, profiles }, sourceId);
}

function sortProfile(profile: Profile): Profile {
  return sortProfileFilters(sortProfileRuleCollections(profile));
}

function reduceProfileCommandDocument(
  current: ProfileDocument,
  command: ProfileCommand,
  sourceId: string,
): ProfileDocument {
  const state = current.state;

  if (command.type === "initialize") {
    if (state.profiles.length > 0 || !isProfile(command.profile)) return current;
    return createInitialProfileDocument(
      command.profile,
      sourceId,
      current.revision + 1,
      current.isPaused,
    );
  }

  if (command.type === "selectProfile") {
    if (
      command.profileId === state.selectedProfileId ||
      !state.profiles.some((profile) => profile.id === command.profileId)
    ) {
      return current;
    }
    return nextDocument(current, { ...state, selectedProfileId: command.profileId }, sourceId);
  }

  if (command.type === "patchProfile") {
    return replaceProfile(current, command.profileId, sourceId, (profile) =>
      applyProfileMetadataPatch(profile, command.patch),
    );
  }

  if (command.type === "reorderProfiles") {
    const sourceIndex = state.profiles.findIndex(
      (profile) => profile.id === command.sourceProfileId,
    );
    const targetIndex = state.profiles.findIndex(
      (profile) => profile.id === command.targetProfileId,
    );
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;
    return nextDocument(
      current,
      { ...state, profiles: arrayMoveImmutable(state.profiles, sourceIndex, targetIndex) },
      sourceId,
    );
  }

  if (command.type === "addProfile") {
    if (
      !isProfile(command.profile) ||
      state.profiles.some((profile) => profile.id === command.profile.id)
    ) {
      return current;
    }
    return nextDocument(
      current,
      {
        profiles: [...state.profiles, command.profile],
        selectedProfileId: command.profile.id,
      },
      sourceId,
    );
  }

  if (command.type === "cloneProfile") {
    const original = state.profiles.find((profile) => profile.id === command.sourceProfileId);
    if (
      !original ||
      !isNonEmptyString(command.cloneId) ||
      state.profiles.some((profile) => profile.id === command.cloneId) ||
      typeof command.title !== "string" ||
      !isProfileBackgroundColor(command.backgroundColor)
    ) {
      return current;
    }
    const clone = applyProfileMetadataPatch(
      { ...structuredClone(original), id: command.cloneId },
      { title: command.title, backgroundColor: command.backgroundColor },
    );
    if (!isProfile(clone)) return current;
    return nextDocument(
      current,
      { profiles: [...state.profiles, clone], selectedProfileId: clone.id },
      sourceId,
    );
  }

  if (command.type === "deleteProfile") {
    const deletedIndex = state.profiles.findIndex((profile) => profile.id === command.profileId);
    if (deletedIndex < 0) return current;
    if (state.profiles.length === 1) {
      if (!isProfile(command.replacement)) return current;
      return nextDocument(
        current,
        { profiles: [command.replacement], selectedProfileId: command.replacement.id },
        sourceId,
      );
    }

    const profiles = state.profiles.filter((profile) => profile.id !== command.profileId);
    const selectedProfileId =
      state.selectedProfileId === command.profileId
        ? profiles[Math.min(deletedIndex, profiles.length - 1)].id
        : state.selectedProfileId;
    return nextDocument(current, { profiles, selectedProfileId }, sourceId);
  }

  if (command.type === "importProfiles") {
    if (!Array.isArray(command.profiles) || command.profiles.length === 0) return current;
    const ids = new Set(state.profiles.map((profile) => profile.id));
    const importedProfiles = command.profiles
      .filter((profile) => {
        if (!isProfile(profile) || ids.has(profile.id)) return false;
        ids.add(profile.id);
        return true;
      })
      .map((profile) => ({ ...profile }));
    if (importedProfiles.length === 0) return current;
    return nextDocument(
      current,
      {
        profiles: [...state.profiles, ...importedProfiles],
        selectedProfileId: importedProfiles[0].id,
      },
      sourceId,
    );
  }

  if (command.type === "addRule") {
    return replaceProfile(current, command.profileId, sourceId, (profile) =>
      addProfileRule(profile, command.collection, command.rule),
    );
  }

  if (command.type === "patchRule") {
    return replaceProfile(current, command.profileId, sourceId, (profile) =>
      patchProfileRule(profile, command.collection, command.ruleId, command.patch),
    );
  }

  if (command.type === "deleteRule") {
    return replaceProfile(current, command.profileId, sourceId, (profile) =>
      deleteProfileRule(profile, command.collection, command.ruleId),
    );
  }

  if (command.type === "cloneRule") {
    return replaceProfile(current, command.profileId, sourceId, (profile) =>
      cloneProfileRule(profile, command.collection, command.ruleId, command.cloneId),
    );
  }

  if (command.type === "setRulesEnabled") {
    return replaceProfile(current, command.profileId, sourceId, (profile) =>
      setProfileRulesEnabled(profile, command.collection, command.enabled),
    );
  }

  if (command.type === "clearRules") {
    return replaceProfile(current, command.profileId, sourceId, (profile) =>
      clearProfileRules(profile, command.collection),
    );
  }

  if (command.type === "convertHeader") {
    return replaceProfile(current, command.profileId, sourceId, (profile) =>
      convertProfileHeader(profile, command.ruleId, command.target),
    );
  }

  if (command.type === "addFilter") {
    return replaceProfile(current, command.profileId, sourceId, (profile) =>
      addProfileFilter(profile, command.filter),
    );
  }

  if (command.type === "patchFilter") {
    return replaceProfile(current, command.profileId, sourceId, (profile) =>
      patchProfileFilter(profile, command.filterId, command.expectedKind, command.patch),
    );
  }

  if (command.type === "changeFilterKind") {
    return replaceProfile(current, command.profileId, sourceId, (profile) =>
      changeProfileFilterKind(profile, command.filterId, command.kind, command.currentTabId),
    );
  }

  if (command.type === "deleteFilter") {
    return replaceProfile(current, command.profileId, sourceId, (profile) =>
      deleteProfileFilter(profile, command.filterId),
    );
  }

  if (command.type === "reorderFilters") {
    return replaceProfile(current, command.profileId, sourceId, (profile) =>
      reorderProfileFilters(profile, command.sourceFilterId, command.targetFilterId),
    );
  }

  if (command.type === "setFiltersEnabled") {
    return replaceProfile(current, command.profileId, sourceId, (profile) =>
      setProfileFiltersEnabled(profile, command.enabled),
    );
  }

  if (command.type === "clearFilters") {
    return replaceProfile(current, command.profileId, sourceId, clearProfileFilters);
  }

  if (command.type === "sortProfileRules") {
    return replaceProfile(current, command.profileId, sourceId, sortProfile);
  }

  if (command.type === "replaceState") {
    if (!isProfileState(command.state) || command.state.profiles.length === 0) return current;
    return nextDocument(current, command.state, sourceId);
  }

  return current;
}

export function reduceProfileCommand(
  current: ProfileDocument,
  command: ProfileCommand,
  sourceId: string,
): ProfileCommandResult {
  const requiresExpectedRevision =
    command.type === "clearRules" ||
    command.type === "clearFilters" ||
    command.type === "replaceState";
  const expectedRevision = expectedProfileCommandRevision(command);
  if (requiresExpectedRevision && !isNonNegativeInteger(expectedRevision)) {
    return { status: "noop", document: current };
  }
  if (expectedRevision !== undefined && expectedRevision !== current.revision) {
    return {
      status: "revision-conflict",
      document: current,
      expected: expectedRevision,
      actual: current.revision,
    };
  }

  const document = reduceProfileCommandDocument(current, command, sourceId);
  return document === current
    ? { status: "noop", document: current }
    : { status: "applied", document };
}
