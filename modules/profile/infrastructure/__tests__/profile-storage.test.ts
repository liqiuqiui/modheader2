import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEmptyProfileDocument,
  createInitialProfileDocument,
} from "../../domain/profile-document";
import { createProfile } from "../../domain/profile-factory";
import { toPersistedState } from "../../domain/profile-persistence";

const storageMocks = vi.hoisted(() => {
  const state = {
    getValue: vi.fn(),
    setValue: vi.fn(),
    watch: vi.fn((_callback: () => void) => () => undefined),
  };
  return {
    state,
    defineItem: vi.fn(() => state),
  };
});

vi.mock("wxt/utils/storage", () => ({
  storage: { defineItem: storageMocks.defineItem },
}));

import {
  PROFILE_STATE_STORAGE_KEY,
  readStoredProfileDocument,
  watchStoredProfileDocument,
  writeStoredProfileDocument,
} from "../profile-storage";

describe("profile state storage", () => {
  beforeEach(() => {
    storageMocks.state.getValue.mockReset();
    storageMocks.state.setValue.mockReset();
    storageMocks.state.watch.mockReset();
    storageMocks.state.setValue.mockResolvedValue(undefined);
    storageMocks.state.watch.mockReturnValue(() => undefined);
    storageMocks.state.getValue.mockResolvedValue({
      state: { profiles: [], selectedProfile: 0, isPaused: false },
      revision: 0,
      sourceId: "",
    });
  });

  it("stores canonical state and command metadata atomically in one storage item", () => {
    expect(PROFILE_STATE_STORAGE_KEY).toBe("local:profile-state");
    expect(storageMocks.defineItem).toHaveBeenCalledWith("local:profile-state", {
      defaultValue: {
        state: { profiles: [], selectedProfile: 0, isPaused: false },
        revision: 0,
        sourceId: "",
      },
    });
  });

  it("round-trips canonical state with revision metadata", async () => {
    const profile = createProfile({
      id: "profile-1",
      title: "Current",
      backgroundColor: "#2563eb",
    });
    const document = createInitialProfileDocument(profile, "client-a", 4);
    const persisted = {
      state: toPersistedState([profile], 0, false),
      revision: 4,
      sourceId: "client-a",
    };
    storageMocks.state.getValue.mockResolvedValue(persisted);

    await expect(readStoredProfileDocument()).resolves.toMatchObject({
      schemaVersion: 1,
      revision: 4,
      sourceId: "client-a",
      isPaused: false,
      state: {
        selectedProfileId: "profile-1",
        profiles: [{ id: "profile-1", title: "Current" }],
      },
    });
    await expect(writeStoredProfileDocument(document)).resolves.toBeUndefined();
    expect(storageMocks.state.setValue).toHaveBeenCalledWith(persisted);
  });

  it("treats invalid canonical state as an empty document", async () => {
    storageMocks.state.getValue.mockResolvedValue({ schemaVersion: 1 });

    await expect(readStoredProfileDocument()).resolves.toEqual(createEmptyProfileDocument());
  });

  it("re-reads the document when storage changes", async () => {
    let listener: (() => void) | undefined;
    storageMocks.state.watch.mockImplementation((callback: () => void) => {
      listener = callback;
      return () => undefined;
    });
    const callback = vi.fn();
    watchStoredProfileDocument(callback);

    listener?.();
    await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
  });

  it("refuses to persist an invalid document", async () => {
    const invalid = {
      ...createEmptyProfileDocument(),
      state: { profiles: [], selectedProfileId: "missing" },
    };

    await expect(writeStoredProfileDocument(invalid as never)).rejects.toThrow(
      "Refusing to persist an invalid profile document",
    );
    expect(storageMocks.state.setValue).not.toHaveBeenCalled();
  });
});
