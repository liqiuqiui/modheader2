import { isNonNegativeInteger } from "../../types/profile/profile-guards";
import type { Profile } from "../../types/profile/profile-model";

/**
 * Command name prefix for "select the Nth profile". The suffix is 1-based to
 * match both the manifest command names (`switch_to_profile_1`) and the legacy
 * ModHeader muscle memory, so `switch_to_profile_1` must resolve to the *first*
 * profile — never to `profiles[1]`.
 */
export const PROFILE_SWITCH_COMMAND_PREFIX = "switch_to_profile_";

/**
 * Maps a `browser.commands` name to the profile it should select, or `undefined`
 * when the command is not a profile switch or its suffix is not a positive
 * integer (`switch_to_profile_0`, `switch_to_profile_x`, `switch_to_profile_`).
 *
 * Returns the profile's `id` rather than its array index so callers cannot
 * accidentally reintroduce the 1-based/0-based confusion.
 */
export function resolveProfileSwitchTargetId(
  command: string,
  profiles: readonly Profile[],
): string | undefined {
  if (!command.startsWith(PROFILE_SWITCH_COMMAND_PREFIX)) return undefined;

  const suffix = command.slice(PROFILE_SWITCH_COMMAND_PREFIX.length);
  // `Number.parseInt("1abc")` is 1, so require a fully numeric suffix.
  if (!/^\d+$/.test(suffix)) return undefined;

  const position = Number.parseInt(suffix, 10);
  if (!isNonNegativeInteger(position) || position < 1) return undefined;

  return profiles[position - 1]?.id;
}
