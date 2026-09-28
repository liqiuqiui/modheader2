import { isRecord } from "./profile-guards";

/**
 * Command errors travel from the background to the UI, so the UI cannot rely on
 * a pre-formatted English sentence: it needs a stable code plus numeric params
 * to look up a localized message.
 */
export const PROFILE_ERROR_CODES = [
  "revisionConflict",
  "commandTimeout",
  "invalidResponse",
  "invalidStorageDocument",
  "commandRejected",
] as const;

export type ProfileErrorCode = (typeof PROFILE_ERROR_CODES)[number];

export interface ProfileErrorPayload {
  code: ProfileErrorCode;
  params?: Record<string, number>;
}

export interface ProfileError extends ProfileErrorPayload {
  /** English fallback, also used for console logs. */
  message: string;
}

export function isProfileErrorCode(value: unknown): value is ProfileErrorCode {
  return typeof value === "string" && (PROFILE_ERROR_CODES as readonly string[]).includes(value);
}

function isNumericParams(value: unknown): value is Record<string, number> {
  return (
    isRecord(value) && Object.values(value).every((entry) => Number.isFinite(entry as unknown))
  );
}

export function isProfileErrorPayload(value: unknown): value is ProfileErrorPayload {
  if (!isRecord(value) || !isProfileErrorCode(value.code)) return false;
  return value.params === undefined || isNumericParams(value.params);
}

export function createProfileError(
  code: ProfileErrorCode,
  params?: Record<string, number>,
  message?: string,
): ProfileError {
  return { code, params, message: message ?? code };
}

/** Rebuilds a localized-ready error from anything caught at a boundary. */
export function toProfileError(error: unknown, fallbackCode: ProfileErrorCode): ProfileError {
  if (error instanceof Error) {
    const payload = (error as Error & { profileError?: ProfileErrorPayload }).profileError;
    if (payload && isProfileErrorPayload(payload)) {
      return { ...payload, message: error.message };
    }
    return { code: fallbackCode, message: error.message };
  }
  return { code: fallbackCode, message: String(error) };
}
