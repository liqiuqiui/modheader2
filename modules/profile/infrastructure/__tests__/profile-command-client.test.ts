import { describe, expect, it, vi } from "vitest";
import type { ProfileCommand } from "../../application/profile-command";
import { createEmptyProfileDocument, type ProfileDocument } from "../../domain/profile-document";
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

function createClient(sendMessage: ProfileCommandClientOptions["sendMessage"]) {
  return createProfileCommandClient({ clientId: "client-test", sendMessage });
}

describe("Profile command client", () => {
  it("sends every queued command immediately but exposes responses in command order", async () => {
    const requests = [deferred<unknown>(), deferred<unknown>(), deferred<unknown>()];
    const sendMessage = vi.fn(
      (_message: ProfileCommandMessage) => requests[sendMessage.mock.calls.length - 1].promise,
    );
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

    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(sendMessage.mock.calls.map(([message]) => message)).toEqual(
      commands.map((command) => ({
        channel: PROFILE_COMMAND_CHANNEL,
        clientId: "client-test",
        command,
      })),
    );

    requests[2].resolve({ ok: true, document: document(3) });
    requests[1].resolve({ ok: true, document: document(2) });
    await Promise.resolve();
    expect(settled).toEqual([]);

    requests[0].resolve({ ok: true, document: document(1) });
    await expect(Promise.all(results)).resolves.toEqual([document(1), document(2), document(3)]);
    expect(settled).toEqual([0, 1, 2]);
  });

  it("continues delivering later responses after an earlier command fails", async () => {
    const requests = [deferred<unknown>(), deferred<unknown>()];
    const sendMessage = vi.fn(
      (_message: ProfileCommandMessage) => requests[sendMessage.mock.calls.length - 1].promise,
    );
    const client = createClient(sendMessage);

    const first = client.enqueueProfileCommand({
      type: "selectProfile",
      profileId: "profile-a",
    });
    const second = client.enqueueProfileCommand({
      type: "selectProfile",
      profileId: "profile-b",
    });

    requests[1].resolve({ ok: true, document: document(2) });
    requests[0].resolve({ ok: false, error: "command failed" });

    await expect(first).rejects.toThrow("command failed");
    await expect(second).resolves.toEqual(document(2));
  });
});
