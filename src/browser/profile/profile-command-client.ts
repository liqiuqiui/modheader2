import { nanoid } from "nanoid";
import { browser } from "wxt/browser";
import type { ProfileCommand } from "../../services/profile/profile-command";
import type { ProfileDocument } from "../../types/profile/profile-document";
import type { ProfileErrorPayload } from "../../types/profile/profile-error";
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

/** Source ids are namespaced (and scoped) so a write can be traced back to the
 * surface that produced it when debugging a revision conflict. */
const PROFILE_SOURCE_ID_PREFIX = "modheader-client";

export function createProfileSourceId(scope = "client"): string {
  return `${PROFILE_SOURCE_ID_PREFIX}-${scope}-${nanoid()}`;
}

export class ProfileCommandError extends Error {
  readonly profileError: ProfileErrorPayload;

  constructor(message: string, payload: ProfileErrorPayload) {
    super(message);
    this.name = "ProfileCommandError";
    this.profileError = payload;
  }
}

function resolveProfileCommandResponse(
  outcomePromise: Promise<ProfileCommandRequestOutcome>,
): Promise<ProfileDocument> {
  return outcomePromise.then((outcome) => {
    if (outcome.status === "rejected") throw outcome.error;

    const response = parseProfileCommandResponse(outcome.response);
    if (!response) {
      throw new ProfileCommandError("Invalid response from profile background", {
        code: "invalidResponse",
      });
    }
    if (!response.ok) {
      throw new ProfileCommandError(response.error, {
        code: response.code ?? "commandRejected",
        params: response.params,
      });
    }
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
          error: new ProfileCommandError(`Profile command timed out after ${timeoutMs}ms`, {
            code: "commandTimeout",
            params: { timeoutMs },
          }),
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
  clientId = createProfileSourceId(),
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
