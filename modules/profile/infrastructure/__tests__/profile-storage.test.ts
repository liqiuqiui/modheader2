import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEmptyProfileDocument,
  createInitialProfileDocument,
} from "../../domain/profile-document";
import { createProfile } from "../../domain/profile-factory";

const storageMocks = vi.hoisted(() => {
  const getValue = vi.fn();
  const setValue = vi.fn();
  const watch = vi.fn((_callback: (value: unknown) => void) => () => undefined);
  return {
    getValue,
    setValue,
    watch,
    defineItem: vi.fn(() => ({ getValue, setValue, watch })),
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
    storageMocks.getValue.mockReset();
    storageMocks.setValue.mockReset();
    storageMocks.watch.mockReset();
    storageMocks.getValue.mockResolvedValue(null);
    storageMocks.setValue.mockResolvedValue(undefined);
    storageMocks.watch.mockReturnValue(() => undefined);
  });

  it("uses the new profile-state key and an empty schema 1 default", () => {
    expect(PROFILE_STATE_STORAGE_KEY).toBe("local:profile-state");
    expect(storageMocks.defineItem).toHaveBeenCalledWith("local:profile-state", {
      defaultValue: createEmptyProfileDocument(),
    });
  });

  it("reads and writes a valid document unchanged", async () => {
    const document = createInitialProfileDocument(
      createProfile({
        id: "profile-1",
        title: "Current",
        backgroundColor: "#2563eb",
      }),
      "client-a",
      4,
    );
    storageMocks.getValue.mockResolvedValue(document);

    await expect(readStoredProfileDocument()).resolves.toBe(document);
    await expect(writeStoredProfileDocument(document)).resolves.toBeUndefined();
    expect(storageMocks.setValue).toHaveBeenCalledWith(document);
  });

  it("treats invalid and old-schema values as an empty document", async () => {
    storageMocks.getValue.mockResolvedValue({
      schemaVersion: 2,
      revision: 9,
      sourceId: "legacy",
      state: { profiles: [], selectedProfileId: null },
    });

    await expect(readStoredProfileDocument()).resolves.toEqual(createEmptyProfileDocument());
    expect(storageMocks.setValue).not.toHaveBeenCalled();
  });

  it("normalizes invalid watched values to the same empty document", () => {
    let listener: ((value: unknown) => void) | undefined;
    storageMocks.watch.mockImplementation((callback: (value: unknown) => void) => {
      listener = callback;
      return () => undefined;
    });
    const callback = vi.fn();
    watchStoredProfileDocument(callback);

    listener?.({ schemaVersion: 99 });

    expect(callback).toHaveBeenCalledWith(createEmptyProfileDocument());
  });

  it("refuses to persist an invalid document", async () => {
    const invalid = {
      ...createEmptyProfileDocument(),
      state: { profiles: [], selectedProfileId: "missing" },
    };

    await expect(writeStoredProfileDocument(invalid as never)).rejects.toThrow(
      "Refusing to persist an invalid profile document",
    );
    expect(storageMocks.setValue).not.toHaveBeenCalled();
  });
});
