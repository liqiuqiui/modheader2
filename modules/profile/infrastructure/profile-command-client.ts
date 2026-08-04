import { nanoid } from "nanoid";
import { browser } from "wxt/browser";
import type { ProfileCommand } from "../application/profile-command";
import type { ProfileDocument } from "../domain/profile-document";
import {
  isProfileCommandResponse,
  PROFILE_COMMAND_CHANNEL,
  type ProfileCommandMessage,
} from "./profile-command-protocol";

export interface ProfileCommandClient {
  clientId: string;
  sendProfileCommand: (command: ProfileCommand) => Promise<ProfileDocument>;
  enqueueProfileCommand: (command: ProfileCommand) => Promise<ProfileDocument>;
}

export interface ProfileCommandClientOptions {
  clientId?: string;
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

    const response = outcome.response;
    if (!isProfileCommandResponse(response)) {
      throw new Error("Invalid response from profile background");
    }
    if (!response.ok) throw new Error(response.error);
    return response.document;
  });
}

export function createProfileCommandClient({
  clientId = nanoid(),
  sendMessage,
}: ProfileCommandClientOptions): ProfileCommandClient {
  let responseQueue: Promise<void> = Promise.resolve();

  const startProfileCommand = (command: ProfileCommand): Promise<ProfileCommandRequestOutcome> => {
    const message: ProfileCommandMessage = {
      channel: PROFILE_COMMAND_CHANNEL,
      clientId,
      command,
    };

    try {
      return sendMessage(message).then(
        (response) => ({ status: "fulfilled", response }),
        (error: unknown) => ({ status: "rejected", error }),
      );
    } catch (error) {
      return Promise.resolve({ status: "rejected", error });
    }
  };

  const sendProfileCommand = (command: ProfileCommand): Promise<ProfileDocument> =>
    resolveProfileCommandResponse(startProfileCommand(command));

  const enqueueProfileCommand = (command: ProfileCommand): Promise<ProfileDocument> => {
    const outcome = startProfileCommand(command);
    const result = responseQueue.then(() => resolveProfileCommandResponse(outcome));
    responseQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  return { clientId, sendProfileCommand, enqueueProfileCommand };
}

const defaultProfileCommandClient = createProfileCommandClient({
  sendMessage: (message) => browser.runtime.sendMessage(message),
});

export const PROFILE_COMMAND_CLIENT_ID = defaultProfileCommandClient.clientId;

export const sendProfileCommand = defaultProfileCommandClient.sendProfileCommand;

export const enqueueProfileCommand = defaultProfileCommandClient.enqueueProfileCommand;
