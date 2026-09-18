import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEmptyProfileDocument,
  createInitialProfileDocument,
  type ProfileDocument,
} from "../types/profile/profile-document";
import { createProfile } from "../types/profile/profile-factory";

const mocks = vi.hoisted(() => {
  let storageListener: ((document: ProfileDocument) => void) | undefined;
  return {
    enqueueProfileCommand: vi.fn(),
    readStoredProfileDocument: vi.fn(),
    watchStoredProfileDocument: vi.fn((listener: (document: ProfileDocument) => void) => {
      storageListener = listener;
      return () => undefined;
    }),
    emitStorageDocument(document: ProfileDocument) {
      storageListener?.(document);
    },
    resetStorageListener() {
      storageListener = undefined;
    },
  };
});

vi.mock("../browser/profile/profile-command-client", () => ({
  enqueueProfileCommand: mocks.enqueueProfileCommand,
  PROFILE_COMMAND_CLIENT_ID: "client-test",
}));

vi.mock("../browser/profile/profile-storage", () => ({
  readStoredProfileDocument: mocks.readStoredProfileDocument,
  watchStoredProfileDocument: mocks.watchStoredProfileDocument,
}));

vi.mock("../i18n", () => ({
  default: {
    getFixedT: () => (_key: string, options?: { number?: number; title?: string }) =>
      options?.title ?? `Profile ${options?.number ?? 1}`,
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("profile store synchronization", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.enqueueProfileCommand.mockReset();
    mocks.readStoredProfileDocument.mockReset();
    mocks.watchStoredProfileDocument.mockClear();
    mocks.resetStorageListener();
  });

  it("accepts the new revision stream after storage resets to an empty document", async () => {
    const original = createProfile({
      id: "profile-original",
      title: "Original",
      backgroundColor: "#2563eb",
    });
    const reinitialized = createProfile({
      id: "profile-reinitialized",
      title: "Reinitialized",
      backgroundColor: "#16a34a",
    });
    const external = createProfile({
      id: "profile-external",
      title: "External",
      backgroundColor: "#0f766e",
    });
    mocks.enqueueProfileCommand
      .mockResolvedValueOnce(createInitialProfileDocument(original, "client-test", 100))
      .mockResolvedValueOnce(createInitialProfileDocument(reinitialized, "client-test", 1));

    const { appStore } = await import("./app-store");
    await appStore.getState().initialize("zh-CN");
    expect(appStore.getState().revision).toBe(100);

    mocks.emitStorageDocument(createEmptyProfileDocument());
    await vi.waitFor(() => expect(appStore.getState().revision).toBe(1));

    mocks.emitStorageDocument(createInitialProfileDocument(external, "external-client", 2));

    expect(appStore.getState()).toMatchObject({
      revision: 2,
      selectedProfileId: external.id,
      profiles: [external],
    });
  });

  it("resets the revision watermark even when storage is cleared during a pending command", async () => {
    const original = createProfile({
      id: "profile-original",
      title: "Original",
      backgroundColor: "#2563eb",
    });
    const pending = { ...original, title: "Pending" };
    const reinitialized = createProfile({
      id: "profile-reinitialized",
      title: "Reinitialized",
      backgroundColor: "#16a34a",
    });
    const external = createProfile({
      id: "profile-external",
      title: "External",
      backgroundColor: "#0f766e",
    });
    const pendingCommand = deferred<ProfileDocument>();
    const resetInitialization = deferred<ProfileDocument>();
    mocks.enqueueProfileCommand
      .mockResolvedValueOnce(createInitialProfileDocument(original, "client-test", 100))
      .mockReturnValueOnce(pendingCommand.promise)
      .mockReturnValueOnce(resetInitialization.promise);

    const { appStore } = await import("./app-store");
    await appStore.getState().initialize("zh-CN");

    const patch = appStore.getState().patchProfile(original.id, { title: pending.title });
    mocks.emitStorageDocument(createEmptyProfileDocument());
    expect(mocks.enqueueProfileCommand).toHaveBeenCalledTimes(3);

    pendingCommand.resolve(createInitialProfileDocument(pending, "client-test", 101));
    await expect(patch).resolves.toBe(true);
    resetInitialization.resolve(createInitialProfileDocument(reinitialized, "client-test", 1));
    await vi.waitFor(() => expect(appStore.getState().revision).toBe(1));

    mocks.emitStorageDocument(createInitialProfileDocument(external, "external-client", 2));
    expect(appStore.getState()).toMatchObject({
      revision: 2,
      selectedProfileId: external.id,
      profiles: [external],
    });
  });

  it("retries initialization when the storage reset changes while initialization is in flight", async () => {
    const stale = createProfile({
      id: "profile-stale",
      title: "Stale",
      backgroundColor: "#2563eb",
    });
    const fresh = createProfile({
      id: "profile-fresh",
      title: "Fresh",
      backgroundColor: "#16a34a",
    });
    const firstInitialization = deferred<ProfileDocument>();
    const secondInitialization = deferred<ProfileDocument>();
    mocks.enqueueProfileCommand
      .mockReturnValueOnce(firstInitialization.promise)
      .mockReturnValueOnce(secondInitialization.promise);

    const { appStore } = await import("./app-store");
    const initialization = appStore.getState().initialize("zh-CN");
    await vi.waitFor(() => expect(mocks.enqueueProfileCommand).toHaveBeenCalledTimes(1));

    mocks.emitStorageDocument(createEmptyProfileDocument());
    mocks.emitStorageDocument(createEmptyProfileDocument());
    firstInitialization.resolve(createInitialProfileDocument(stale, "client-test", 1));
    await initialization;
    await vi.waitFor(() => expect(mocks.enqueueProfileCommand).toHaveBeenCalledTimes(2));

    secondInitialization.resolve(createInitialProfileDocument(fresh, "client-test", 1));
    await vi.waitFor(() => expect(appStore.getState().selectedProfileId).toBe(fresh.id));
  });

  it("rolls back an optimistic edit when command and storage reconciliation both fail", async () => {
    const original = createProfile({
      id: "profile-original",
      title: "Original",
      backgroundColor: "#2563eb",
    });
    mocks.enqueueProfileCommand
      .mockResolvedValueOnce(createInitialProfileDocument(original, "client-test", 1))
      .mockRejectedValueOnce(new Error("command failed"));

    const { appStore } = await import("./app-store");
    await appStore.getState().initialize("zh-CN");
    mocks.readStoredProfileDocument.mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(
      appStore.getState().patchProfile(original.id, { title: "Not persisted" }),
    ).resolves.toBe(false);

    expect(appStore.getState()).toMatchObject({
      revision: 1,
      profiles: [original],
      error: "storage unavailable",
    });
    expect(appStore.getState().past).toEqual([]);
  });
});
