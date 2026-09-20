import { nanoid } from "nanoid";
import { defineBackground } from "wxt/utils/define-background";
import i18n, { initializeI18n } from "../src/i18n";
import { localeStorage } from "../src/i18n/locale-storage";
import type { ProfileCommand } from "../src/services/profile/profile-command";
import {
  isProfileCommandRevisionConflict,
  reduceProfileCommand,
} from "../src/services/profile/reduce-profile-command";
import {
  applyDnrRules,
  compileProfileDnrRules,
  nextProfileTimeFilterExpiration,
} from "../src/browser/profile/profile-dnr";
import { profileActionBadgeController } from "../src/browser/profile/profile-action-badge";
import {
  isProfileCommandMessage,
  type ProfileCommandResponse,
} from "../src/browser/profile/profile-command-protocol";
import {
  readStoredProfileDocument,
  type ProfileDocument,
  watchStoredProfileDocument,
  writeStoredProfileDocument,
} from "../src/browser/profile/profile-storage";
import {
  createDocumentMutationQueue,
  createLatestTask,
} from "../src/browser/profile/profile-background-queue";

const CONTEXT_MENU_ID = "toggle_pause";
const TIME_FILTER_ALARM = "checkTimeFilterAlarm";
const BACKGROUND_SOURCE_ID = nanoid();

function selectedProfile(document: ProfileDocument) {
  const profileId = document.state.selectedProfileId;
  return profileId
    ? document.state.profiles.find((profile) => profile.id === profileId)
    : undefined;
}

async function syncRules() {
  const profile = selectedProfile(await readStoredProfileDocument());
  const tabs = await browser.tabs.query({});
  const compilation = compileProfileDnrRules(profile, { tabs });
  if (compilation.diagnostics.length > 0) {
    console.warn(
      `Profile DNR compilation failed for ${profile?.id ?? "no selected profile"}: ${compilation.diagnostics.join("; ")}`,
    );
  }
  try {
    await applyDnrRules(compilation.rules);
  } catch (error) {
    await profileActionBadgeController.sync(profile, []).catch(console.error);
    throw error;
  }
  await profileActionBadgeController.sync(profile, compilation.rules);
  await browser.alarms.clear(TIME_FILTER_ALARM);
  const expiration = nextProfileTimeFilterExpiration(profile);
  if (expiration !== null) {
    await browser.alarms.create(TIME_FILTER_ALARM, { when: expiration });
  }
}

async function syncContextMenu() {
  await contextMenuReady;
  await initializeI18n();
  const [locale, document] = await Promise.all([
    localeStorage.getValue(),
    readStoredProfileDocument(),
  ]);
  const profile = selectedProfile(document);
  const t = i18n.getFixedT(locale);
  await browser.contextMenus.update(CONTEXT_MENU_ID, {
    title: t(profile?.paused ? "context.resume" : "context.pause"),
  });
}

const scheduleRulesSync = createLatestTask(syncRules);
const scheduleContextMenuSync = createLatestTask(syncContextMenu);
const enqueueDocumentTask = createDocumentMutationQueue();
let contextMenuReady: Promise<void> = Promise.resolve();

function executeProfileCommand(
  command: ProfileCommand,
  sourceId: string,
): Promise<ProfileDocument> {
  return enqueueDocumentTask(async () => {
    const current = await readStoredProfileDocument();
    const result = reduceProfileCommand(current, command, sourceId);
    if (isProfileCommandRevisionConflict(result)) {
      throw new Error(
        `Profile state changed in another window (expected revision ${result.expected}, current revision ${result.actual}).`,
      );
    }
    if (result.status === "applied") await writeStoredProfileDocument(result.document);
    return result.document;
  });
}

async function handleProfileCommand(
  command: ProfileCommand,
  sourceId: string,
): Promise<ProfileCommandResponse> {
  try {
    return { ok: true, document: await executeProfileCommand(command, sourceId) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function createContextMenu() {
  await initializeI18n();
  try {
    await browser.contextMenus.remove(CONTEXT_MENU_ID);
  } catch {
    // The menu does not exist on the first run.
  }
  const locale = await localeStorage.getValue();
  const profile = selectedProfile(await readStoredProfileDocument());
  const t = i18n.getFixedT(locale);
  await browser.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: t(profile?.paused ? "context.resume" : "context.pause"),
    contexts: ["action"],
  });
}

export default defineBackground(() => {
  scheduleRulesSync();
  contextMenuReady = createContextMenu();
  void contextMenuReady.then(scheduleContextMenuSync).catch(console.error);

  watchStoredProfileDocument(() => {
    scheduleRulesSync();
    scheduleContextMenuSync();
  });
  localeStorage.watch(scheduleContextMenuSync);

  browser.runtime.onMessage.addListener((message) => {
    if (!isProfileCommandMessage(message)) return undefined;
    return handleProfileCommand(message.command, message.clientId);
  });

  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      void profileActionBadgeController.observeRequest(details).catch(console.error);
      return undefined;
    },
    { urls: ["<all_urls>"] },
  );

  // A new tab can join an existing group, which changes the tab ids that
  // tab-group and window filters resolve to.
  browser.tabs.onCreated.addListener(() => scheduleRulesSync());

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      void profileActionBadgeController.observeTabUrl(tabId, changeInfo.url).catch(console.error);
    }
    // tabs.onUpdated is the single completion signal for badge rendering.
    // webRequest.onCompleted used to call the same method for main-frame
    // requests, causing duplicate badge writes for every navigation.
    if (changeInfo.status === "complete") {
      void profileActionBadgeController.observeTabComplete(tabId).catch(console.error);
    }
    if (changeInfo.groupId !== undefined) {
      scheduleRulesSync();
    }
  });

  browser.tabs.onAttached.addListener(() => scheduleRulesSync());
  browser.tabs.onDetached.addListener(() => scheduleRulesSync());

  browser.tabs.onActivated.addListener(({ tabId }) => {
    void profileActionBadgeController.observeTabActivated(tabId).catch(console.error);
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    void profileActionBadgeController.forgetTab(tabId).catch(console.error);
    scheduleRulesSync();
  });

  browser.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId !== CONTEXT_MENU_ID) return;
    void enqueueDocumentTask(async () => {
      const current = await readStoredProfileDocument();
      const profileId = current.state.selectedProfileId;
      if (!profileId) return;
      const profile = current.state.profiles.find((candidate) => candidate.id === profileId);
      if (!profile) return;
      const result = reduceProfileCommand(
        current,
        { type: "patchProfile", profileId, patch: { paused: !profile.paused } },
        BACKGROUND_SOURCE_ID,
      );
      if (result.status === "applied") await writeStoredProfileDocument(result.document);
    }).catch(console.error);
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TIME_FILTER_ALARM) scheduleRulesSync();
  });
});
