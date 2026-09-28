import type { TFunction } from "i18next";
import type { ProfileError } from "../../types/profile/profile-error";

/** Errors carry a code rather than a sentence, so the message is resolved here
 * where the active language is known. */
export function translateProfileError(error: ProfileError | null, t: TFunction): string {
  if (!error) return "";
  switch (error.code) {
    case "revisionConflict":
      return t("errors.revisionConflict", error.params ?? {});
    case "commandTimeout":
      return t("errors.commandTimeout", error.params ?? {});
    case "invalidResponse":
      return t("errors.invalidResponse");
    case "invalidStorageDocument":
      return t("errors.invalidStorageDocument");
    case "commandRejected":
      return t("errors.commandRejected");
    default:
      // A code added without a translation must still show something, or the
      // toast renders empty while staying dismissible.
      return error.message;
  }
}
