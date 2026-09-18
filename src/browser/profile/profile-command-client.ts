import { nanoid } from "nanoid";
import { browser } from "wxt/browser";
import type { ProfileCommand } from "../../services/profile/profile-command";
import type { ProfileDocument } from "../../types/profile/profile-document";
import {
  parseProfileCommandResponse,
  PROFILE_COMMAND_CHANNEL,
  type ProfileCommandMessage,
} from "./profile-command-protocol";

const DEFAULT_PROFILE_COMMAND_TIMEOUT_MS = 10_000;

export interface ProfileCommandClient {
  clientId: string;
  enqueueProfileCommand: (command: ProfileCommand) => Promise<ProfileDocument>;
}

export interface ProfileCommandClientOptions {
  clientId?: string;
  requestTimeoutMs?: number;
  sendMessage: (message: ProfileCommandMessage) => Promise<unknown>;
}

type ProfileCommandRequestOutcome =
  | { status: "fulfilled"; response: unknown }
  | { status: "rejected"; error: unknown };

function resolveProfileCommandResponse(
  outcomePromise: Promise<ProfileCommandRequestOutcome>,
): Promise<ProfileDocument> {
  return outcomePromise.then((outcome) => {
    if (outcome.status === "rejected") throw outcome.error;

    const response = parseProfileCommandResponse(outcome.response);
    if (!response) {
      throw new Error("Invalid response from profile background");
    }
    if (!response.ok) throw new Error(response.error);
    return response.document;
  });
}

function settleProfileCommandRequest(
  request: Promise<unknown>,
  timeoutMs: number,
): Promise<ProfileCommandRequestOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
    const finish = (outcome: ProfileCommandRequestOutcome) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
      resolve(outcome);
    };
    timeoutId = globalThis.setTimeout(
      () =>
        finish({
          status: "rejected",
          error: new Error(`Profile command timed out after ${timeoutMs}ms`),
        }),
      timeoutMs,
    );
    request.then(
      (response) => finish({ status: "fulfilled", response }),
      (error: unknown) => finish({ status: "rejected", error }),
    );
  });
}

export function createProfileCommandClient({
  clientId = nanoid(),
  requestTimeoutMs = DEFAULT_PROFILE_COMMAND_TIMEOUT_MS,
  sendMessage,
}: ProfileCommandClientOptions): ProfileCommandClient {
  // Keep queued commands bounded to one in-flight runtime request. The
  // background also serializes document mutations, so starting every request
  // eagerly only creates an unbounded message/storage backlog. The first
  // command still starts synchronously; subsequent commands wait until the
  // previous response has settled (including validation failures).
  let commandQueue: Promise<void> | null = null;

  const startProfileCommand = (command: ProfileCommand): Promise<ProfileCommandRequestOutcome> => {
    const message: ProfileCommandMessage = {
      channel: PROFILE_COMMAND_CHANNEL,
      clientId,
      command,
    };

    try {
      return settleProfileCommandRequest(sendMessage(message), requestTimeoutMs);
    } catch (error) {
      return Promise.resolve({ status: "rejected", error });
    }
  };

  const enqueueProfileCommand = (command: ProfileCommand): Promise<ProfileDocument> => {
    const result = commandQueue
      ? commandQueue.then(() => resolveProfileCommandResponse(startProfileCommand(command)))
      : resolveProfileCommandResponse(startProfileCommand(command));
    commandQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  return { clientId, enqueueProfileCommand };
}

const defaultProfileCommandClient = createProfileCommandClient({
  sendMessage: (message) => browser.runtime.sendMessage(message),
});

export const PROFILE_COMMAND_CLIENT_ID = defaultProfileCommandClient.clientId;

export const enqueueProfileCommand = defaultProfileCommandClient.enqueueProfileCommand;
