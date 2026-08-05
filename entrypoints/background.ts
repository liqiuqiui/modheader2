import { nanoid } from "nanoid";
import { defineBackground } from "wxt/utils/define-background";
import i18n, { initializeI18n } from "../i18n";
import { localeStorage } from "../i18n/locale-storage";
import type { ProfileCommand } from "../modules/profile/application/profile-command";
import {
  isProfileCommandRevisionConflict,
  reduceProfileCommand,
} from "../modules/profile/application/reduce-profile-command";
import {
  applyDnrRules,
  compileProfileDnrRules,
} from "../modules/profile/infrastructure/profile-dnr";
import { profileActionBadgeController } from "../modules/profile/infrastructure/profile-action-badge";
import {
  isProfileCommandMessage,
  type ProfileCommandResponse,
} from "../modules/profile/infrastructure/profile-command-protocol";
import {
  profileStateStorage,
  readStoredProfileDocument,
  type ProfileDocument,
  writeStoredProfileDocument,
} from "../modules/profile/infrastructure/profile-storage";

const CONTEXT_MENU_ID = "toggle_pause";
const BACKGROUND_SOURCE_ID = nanoid();

let documentMutationQueue: Promise<void> = Promise.resolve();

function selectedProfile(document: ProfileDocument) {
  if (!document.selectedProfileId) return undefined;
  return document.profilesById[document.selectedProfileId];
}

async function syncRules() {
  const profile = selectedProfile(await readStoredProfileDocument());
  const compilation = compileProfileDnrRules(profile);
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
}

async function syncContextMenu() {
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

function latestTask(task: () => Promise<void>) {
  let requested = false;
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      while (requested) {
        requested = false;
        await task();
      }
    } catch (error) {
      console.error(error);
    } finally {
      running = false;
      if (requested) void run();
    }
  };

  return () => {
    requested = true;
    void run();
  };
}

const scheduleRulesSync = latestTask(syncRules);
const scheduleContextMenuSync = latestTask(syncContextMenu);

function enqueueDocumentTask<T>(task: () => Promise<T>): Promise<T> {
  const result = documentMutationQueue.then(task);
  documentMutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

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
  browser.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: t(profile?.paused ? "context.resume" : "context.pause"),
    contexts: ["action"],
  });
}

export default defineBackground(() => {
  scheduleRulesSync();
  void createContextMenu().then(scheduleContextMenuSync).catch(console.error);

  profileStateStorage.watch(() => {
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

  browser.webRequest.onCompleted.addListener(
    (details) => {
      void profileActionBadgeController.observeTabComplete(details.tabId).catch(console.error);
    },
    { urls: ["<all_urls>"], types: ["main_frame"] },
  );

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      void profileActionBadgeController.observeTabUrl(tabId, changeInfo.url).catch(console.error);
    }
    if (changeInfo.status === "complete") {
      void profileActionBadgeController.observeTabComplete(tabId).catch(console.error);
    }
  });

  browser.tabs.onActivated.addListener(({ tabId }) => {
    void profileActionBadgeController.observeTabActivated(tabId).catch(console.error);
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    void profileActionBadgeController.forgetTab(tabId).catch(console.error);
  });

  browser.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId !== CONTEXT_MENU_ID) return;
    void enqueueDocumentTask(async () => {
      const current = await readStoredProfileDocument();
      const profileId = current.selectedProfileId;
      if (!profileId) return;
      const profile = current.profilesById[profileId];
      if (!profile) return;
      const result = reduceProfileCommand(
        current,
        { type: "patchProfile", profileId, patch: { paused: !profile.paused } },
        BACKGROUND_SOURCE_ID,
      );
      if (result.status === "applied") await writeStoredProfileDocument(result.document);
    }).catch(console.error);
  });
});
