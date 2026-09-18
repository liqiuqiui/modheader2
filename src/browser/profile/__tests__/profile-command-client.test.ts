import { describe, expect, it, vi } from "vitest";
import type { ProfileCommand } from "../../../services/profile/profile-command";
import {
  createEmptyProfileDocument,
  type ProfileDocument,
} from "../../../types/profile/profile-document";
import {
  createProfileCommandClient,
  type ProfileCommandClientOptions,
} from "../profile-command-client";
import { PROFILE_COMMAND_CHANNEL, type ProfileCommandMessage } from "../profile-command-protocol";

vi.mock("wxt/browser", () => ({
  browser: { runtime: { sendMessage: vi.fn() } },
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function document(revision: number): ProfileDocument {
  return {
    ...createEmptyProfileDocument(),
    revision,
    sourceId: "client-test",
  };
}

function createClient(
  sendMessage: ProfileCommandClientOptions["sendMessage"],
  requestTimeoutMs?: number,
) {
  return createProfileCommandClient({ clientId: "client-test", requestTimeoutMs, sendMessage });
}

describe("Profile command client", () => {
  it("applies backpressure while preserving queued command order", async () => {
    const requests: Deferred<unknown>[] = [];
    const sendMessage = vi.fn((_message: ProfileCommandMessage) => {
      const request = deferred<unknown>();
      requests.push(request);
      return request.promise;
    });
    const client = createClient(sendMessage);
    const commands: ProfileCommand[] = [
      { type: "selectProfile", profileId: "profile-a" },
      { type: "selectProfile", profileId: "profile-b" },
      { type: "selectProfile", profileId: "profile-c" },
    ];

    const settled: number[] = [];
    const results = commands.map((command, index) =>
      client.enqueueProfileCommand(command).then((result) => {
        settled.push(index);
        return result;
      }),
    );

    // The first request starts immediately; later requests wait for the
    // previous response instead of piling up in the browser runtime.
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0][0]).toEqual({
      channel: PROFILE_COMMAND_CHANNEL,
      clientId: "client-test",
      command: commands[0],
    });
    expect(settled).toEqual([]);

    requests[0].resolve({ ok: true, document: document(1) });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
    expect(sendMessage.mock.calls[1][0]).toEqual({
      channel: PROFILE_COMMAND_CHANNEL,
      clientId: "client-test",
      command: commands[1],
    });

    requests[1].resolve({ ok: true, document: document(2) });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(3));
    expect(sendMessage.mock.calls[2][0]).toEqual({
      channel: PROFILE_COMMAND_CHANNEL,
      clientId: "client-test",
      command: commands[2],
    });

    requests[2].resolve({ ok: true, document: document(3) });
    await expect(Promise.all(results)).resolves.toEqual([document(1), document(2), document(3)]);
    expect(settled).toEqual([0, 1, 2]);
  });

  it("continues delivering later responses after an earlier command fails", async () => {
    const requests: Deferred<unknown>[] = [];
    const sendMessage = vi.fn((_message: ProfileCommandMessage) => {
      const request = deferred<unknown>();
      requests.push(request);
      return request.promise;
    });
    const client = createClient(sendMessage);

    const first = client.enqueueProfileCommand({
      type: "selectProfile",
      profileId: "profile-a",
    });
    const second = client.enqueueProfileCommand({
      type: "selectProfile",
      profileId: "profile-b",
    });

    requests[0].resolve({ ok: false, error: "command failed" });

    await expect(first).rejects.toThrow("command failed");
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
    requests[1].resolve({ ok: true, document: document(2) });
    await expect(second).resolves.toEqual(document(2));
  });

  it("releases queued commands after an in-flight request times out", async () => {
    vi.useFakeTimers();
    try {
      const requests: Deferred<unknown>[] = [];
      const sendMessage = vi.fn((_message: ProfileCommandMessage) => {
        const request = deferred<unknown>();
        requests.push(request);
        return request.promise;
      });
      const client = createClient(sendMessage, 25);

      const first = client
        .enqueueProfileCommand({ type: "selectProfile", profileId: "profile-a" })
        .catch((error: unknown) => error);
      const second = client.enqueueProfileCommand({
        type: "selectProfile",
        profileId: "profile-b",
      });

      expect(sendMessage).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(25);
      await expect(first).resolves.toEqual(
        expect.objectContaining({ message: expect.any(String) }),
      );
      expect(await first).toMatchObject({ message: "Profile command timed out after 25ms" });
      await Promise.resolve();
      expect(sendMessage).toHaveBeenCalledTimes(2);

      requests[1].resolve({ ok: true, document: document(2) });
      await expect(second).resolves.toEqual(document(2));
    } finally {
      vi.useRealTimers();
    }
  });
});
