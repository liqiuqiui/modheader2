import type { StoreApi } from "zustand/vanilla";
import type { Locale } from "../config/locales";
import {
  enqueueProfileCommand,
  PROFILE_COMMAND_CLIENT_ID,
} from "../browser/profile/profile-command-client";
import type { ProfileDocument } from "../types/profile/profile-document";
import type { Profile } from "../types/profile/profile-model";
import type { ProfileCommand } from "../services/profile/profile-command";
import type { AppStoreState } from "./app-store-contract";

export interface AppRuntime {
  initializationPromise: Promise<void> | null;
  stopWatchingStorage: (() => void) | null;
  pendingCommands: number;
  deferredDocument: ProfileDocument | null;
  authoritativeDocument: ProfileDocument | null;
  lastAuthoritativeRevision: number;
  sawExternalChange: boolean;
  commandFailed: boolean;
  storageResetPending: boolean;
  storageResetGeneration: number;
  currentLocale: Locale;
  commandSettlementWaiters: Array<() => void>;
}

export function createAppRuntime(): AppRuntime {
  return {
    initializationPromise: null,
    stopWatchingStorage: null,
    pendingCommands: 0,
    deferredDocument: null,
    authoritativeDocument: null,
    lastAuthoritativeRevision: 0,
    sawExternalChange: false,
    commandFailed: false,
    storageResetPending: false,
    storageResetGeneration: 0,
    currentLocale: "zh-CN",
    commandSettlementWaiters: [],
  };
}

export function waitForPendingCommands(runtime: AppRuntime): Promise<void> {
  if (runtime.pendingCommands === 0) return Promise.resolve();
  return new Promise((resolve) => runtime.commandSettlementWaiters.push(resolve));
}

export function resolveCommandSettlementWaiters(runtime: AppRuntime): void {
  const waiters = runtime.commandSettlementWaiters;
  runtime.commandSettlementWaiters = [];
  for (const resolve of waiters) resolve();
}

export function rememberDeferredDocument(runtime: AppRuntime, document: ProfileDocument): void {
  if (!runtime.deferredDocument || document.revision >= runtime.deferredDocument.revision) {
    runtime.deferredDocument = document;
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type ApplyDocument = (
  document: ProfileDocument,
  options: { clearHistory: boolean; error?: string | null },
) => void;

interface ProfileCommandRuntimeContext {
  runtime: AppRuntime;
  set: StoreApi<AppStoreState>["setState"];
  applyDocument: ApplyDocument;
  synchronizeAfterCommands: () => Promise<void>;
}

export function createProfileCommandDispatcher(context: ProfileCommandRuntimeContext) {
  const { runtime, set, applyDocument, synchronizeAfterCommands } = context;

  return async function dispatchCommand(command: ProfileCommand): Promise<boolean> {
    runtime.pendingCommands += 1;
    try {
      const document = await enqueueProfileCommand(command);
      if (runtime.storageResetPending) return true;
      if (document.sourceId !== PROFILE_COMMAND_CLIENT_ID) runtime.sawExternalChange = true;
      if (
        runtime.lastAuthoritativeRevision > 0 &&
        document.revision > runtime.lastAuthoritativeRevision + 1
      ) {
        runtime.sawExternalChange = true;
      }
      runtime.lastAuthoritativeRevision = Math.max(
        runtime.lastAuthoritativeRevision,
        document.revision,
      );
      rememberDeferredDocument(runtime, document);
      return true;
    } catch (error) {
      runtime.commandFailed = true;
      set({ error: errorMessage(error) });
      return false;
    } finally {
      runtime.pendingCommands -= 1;
      if (runtime.pendingCommands === 0) {
        try {
          if (!runtime.storageResetPending) await synchronizeAfterCommands();
        } catch (synchronizationError) {
          const message = errorMessage(synchronizationError);
          if (runtime.authoritativeDocument) {
            applyDocument(runtime.authoritativeDocument, { clearHistory: true, error: message });
          } else {
            set({ status: "error", error: message });
          }
        } finally {
          resolveCommandSettlementWaiters(runtime);
        }
      }
    }
  };
}

interface ProfileStorageRuntimeContext {
  runtime: AppRuntime;
  applyDocument: ApplyDocument;
  requestInitialization: (locale: Locale) => Promise<void>;
}

export function createProfileStorageWatcher(context: ProfileStorageRuntimeContext) {
  const { runtime, applyDocument, requestInitialization } = context;

  return (document: ProfileDocument): void => {
    if (document.state.profiles.length === 0) {
      runtime.storageResetPending = true;
      runtime.storageResetGeneration += 1;
      runtime.lastAuthoritativeRevision = document.revision;
      runtime.authoritativeDocument = document;
      runtime.deferredDocument = null;
      runtime.sawExternalChange = false;
      runtime.commandFailed = false;
      void requestInitialization(runtime.currentLocale);
      return;
    }

    if (runtime.storageResetPending) {
      runtime.lastAuthoritativeRevision = document.revision;
      runtime.authoritativeDocument = document;
      runtime.deferredDocument = null;
      runtime.sawExternalChange = false;
      runtime.commandFailed = false;
      if (runtime.pendingCommands > 0) {
        rememberDeferredDocument(runtime, document);
        return;
      }
      applyDocument(document, { clearHistory: true });
      if (!runtime.initializationPromise) runtime.storageResetPending = false;
      return;
    }

    if (document.revision < runtime.lastAuthoritativeRevision) return;
    if (runtime.pendingCommands > 0) {
      if (document.sourceId !== PROFILE_COMMAND_CLIENT_ID) runtime.sawExternalChange = true;
      rememberDeferredDocument(runtime, document);
      return;
    }
    applyDocument(document, {
      clearHistory: document.sourceId !== PROFILE_COMMAND_CLIENT_ID,
    });
    if (runtime.storageResetPending && !runtime.initializationPromise) {
      runtime.storageResetPending = false;
    }
  };
}

interface ProfileInitializationContext {
  runtime: AppRuntime;
  set: StoreApi<AppStoreState>["setState"];
  applyDocument: ApplyDocument;
  createProfile: (locale: Locale) => Profile;
}

export function createProfileInitializer(context: ProfileInitializationContext) {
  const { runtime, set, applyDocument, createProfile } = context;

  const requestInitialization = (locale: Locale): Promise<void> => {
    if (runtime.initializationPromise) return runtime.initializationPromise;
    set({ status: "loading", error: null });
    const profile = createProfile(locale);
    const resetGeneration = runtime.storageResetGeneration;
    runtime.initializationPromise = enqueueProfileCommand({ type: "initialize", profile })
      .then((document) => {
        if (resetGeneration !== runtime.storageResetGeneration) return;
        if (runtime.storageResetPending) {
          runtime.lastAuthoritativeRevision = document.revision;
          runtime.deferredDocument = null;
          runtime.sawExternalChange = false;
          runtime.commandFailed = false;
          runtime.storageResetPending = false;
        }
        applyDocument(document, { clearHistory: true });
      })
      .catch((error) => {
        if (runtime.storageResetPending && runtime.authoritativeDocument?.state.profiles.length) {
          runtime.storageResetPending = false;
          applyDocument(runtime.authoritativeDocument, { clearHistory: true });
          return;
        }
        set({ status: "error", error: errorMessage(error) });
      })
      .finally(() => {
        runtime.initializationPromise = null;
        if (resetGeneration !== runtime.storageResetGeneration) {
          void requestInitialization(runtime.currentLocale);
        }
      });
    return runtime.initializationPromise;
  };

  return requestInitialization;
}
