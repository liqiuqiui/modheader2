import { isArray, isEmpty } from "lodash-es";
import { moveItemById } from "../domain/profile-collections";
import { isNonEmptyString, isNonNegativeInteger } from "../domain/profile-guards";
import {
  addProfileFilter,
  changeProfileFilterKind,
  clearProfileFilters,
  deleteProfileFilter,
  patchProfileFilter,
  reorderProfileFilters,
  setProfileFiltersEnabled,
  sortProfileFilters,
} from "../domain/profile-filter-operations";
import {
  createInitialProfileDocument,
  PROFILE_DOCUMENT_SCHEMA_VERSION,
  type ProfileDocument,
  type ProfileSnapshot,
} from "../domain/profile-document";
import type { Profile } from "../domain/profile-model";
import { applyProfileMetadataPatch } from "../domain/profile-operations";
import {
  addProfileRule,
  clearProfileRules,
  cloneProfileRule,
  convertProfileHeader,
  deleteProfileRule,
  patchProfileRule,
  setProfileRulesEnabled,
  sortProfileRuleCollections,
} from "../domain/profile-rule-operations";
import { isProfile, isProfileSnapshot } from "../domain/profile-validation";
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
  snapshot: ProfileSnapshot,
  sourceId: string,
): ProfileDocument {
  return {
    schemaVersion: PROFILE_DOCUMENT_SCHEMA_VERSION,
    revision: current.revision + 1,
    sourceId,
    profilesById: snapshot.profilesById,
    profileOrder: snapshot.profileOrder,
    selectedProfileId: snapshot.selectedProfileId,
  };
}

function replaceProfile(
  current: ProfileDocument,
  profileId: string,
  sourceId: string,
  update: (profile: Profile) => Profile,
): ProfileDocument {
  if (!Object.hasOwn(current.profilesById, profileId)) return current;
  const profile = current.profilesById[profileId];
  const nextProfile = update(profile);
  if (nextProfile === profile || !isProfile(nextProfile)) return current;
  return nextDocument(
    current,
    {
      profilesById: { ...current.profilesById, [profileId]: nextProfile },
      profileOrder: current.profileOrder,
      selectedProfileId: current.selectedProfileId,
    },
    sourceId,
  );
}

function sortProfile(profile: Profile): Profile {
  return sortProfileFilters(sortProfileRuleCollections(profile));
}

function reduceProfileCommandDocument(
  current: ProfileDocument,
  command: ProfileCommand,
  sourceId: string,
): ProfileDocument {
  if (command.type === "initialize") {
    if (current.profileOrder.length > 0 || !isProfile(command.profile)) return current;
    return createInitialProfileDocument(command.profile, sourceId, current.revision + 1);
  }

  if (command.type === "selectProfile") {
    if (
      command.profileId === current.selectedProfileId ||
      !Object.hasOwn(current.profilesById, command.profileId)
    ) {
      return current;
    }
    return nextDocument(
      current,
      {
        profilesById: current.profilesById,
        profileOrder: current.profileOrder,
        selectedProfileId: command.profileId,
      },
      sourceId,
    );
  }

  if (command.type === "patchProfile") {
    return replaceProfile(current, command.profileId, sourceId, (profile) =>
      applyProfileMetadataPatch(profile, command.patch),
    );
  }

  if (command.type === "reorderProfiles") {
    const profileOrder = moveItemById(
      current.profileOrder,
      command.sourceProfileId,
      command.targetProfileId,
    );
    if (profileOrder === current.profileOrder) return current;
    return nextDocument(
      current,
      {
        profilesById: current.profilesById,
        profileOrder,
        selectedProfileId: current.selectedProfileId,
      },
      sourceId,
    );
  }

  if (command.type === "addProfile") {
    if (!isProfile(command.profile) || Object.hasOwn(current.profilesById, command.profile.id)) {
      return current;
    }
    return nextDocument(
      current,
      {
        profilesById: { ...current.profilesById, [command.profile.id]: command.profile },
        profileOrder: [...current.profileOrder, command.profile.id],
        selectedProfileId: command.profile.id,
      },
      sourceId,
    );
  }

  if (command.type === "cloneProfile") {
    if (
      !Object.hasOwn(current.profilesById, command.sourceProfileId) ||
      !isNonEmptyString(command.cloneId) ||
      Object.hasOwn(current.profilesById, command.cloneId) ||
      typeof command.title !== "string" ||
      !isNonEmptyString(command.backgroundColor)
    ) {
      return current;
    }
    const source = current.profilesById[command.sourceProfileId];
    const clone = applyProfileMetadataPatch(
      { ...structuredClone(source), id: command.cloneId },
      { title: command.title, backgroundColor: command.backgroundColor },
    );
    if (!isProfile(clone)) return current;
    return nextDocument(
      current,
      {
        profilesById: { ...current.profilesById, [clone.id]: clone },
        profileOrder: [...current.profileOrder, clone.id],
        selectedProfileId: clone.id,
      },
      sourceId,
    );
  }

  if (command.type === "deleteProfile") {
    if (!Object.hasOwn(current.profilesById, command.profileId)) return current;
    if (current.profileOrder.length === 1) {
      if (!isProfile(command.replacement)) return current;
      return nextDocument(
        current,
        {
          profilesById: { [command.replacement.id]: command.replacement },
          profileOrder: [command.replacement.id],
          selectedProfileId: command.replacement.id,
        },
        sourceId,
      );
    }

    const deletedIndex = current.profileOrder.indexOf(command.profileId);
    const profileOrder = current.profileOrder.filter((id) => id !== command.profileId);
    const profilesById = { ...current.profilesById };
    delete profilesById[command.profileId];
    const selectedProfileId =
      current.selectedProfileId === command.profileId
        ? profileOrder[Math.min(deletedIndex, profileOrder.length - 1)]
        : current.selectedProfileId;
    return nextDocument(current, { profilesById, profileOrder, selectedProfileId }, sourceId);
  }

  if (command.type === "importProfiles") {
    if (!isArray(command.profiles) || isEmpty(command.profiles)) return current;
    const profilesById = { ...current.profilesById };
    const importedProfiles = command.profiles.filter((profile) => {
      if (!isProfile(profile) || Object.hasOwn(profilesById, profile.id)) return false;
      profilesById[profile.id] = profile;
      return true;
    });
    if (importedProfiles.length === 0) return current;
    return nextDocument(
      current,
      {
        profilesById,
        profileOrder: [...current.profileOrder, ...importedProfiles.map((profile) => profile.id)],
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

  if (command.type === "replaceSnapshot") {
    if (!isProfileSnapshot(command.snapshot) || command.snapshot.profileOrder.length === 0) {
      return current;
    }
    return nextDocument(current, command.snapshot, sourceId);
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
    command.type === "replaceSnapshot";
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
