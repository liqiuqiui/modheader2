import { isRecord } from "./profile-guards";
import type { PersistedProfile, Profile } from "./profile-model";
import { createProfileDocument, type ProfileDocument } from "./profile-document";
import { isProfile } from "./profile-validation";

/**
 * The stored shape is validated with `hasExactKeys`, so a document written
 * before `alwaysOn`, `setCookies` or `writeMode` existed would be rejected
 * wholesale and surface as `invalidStorageDocument` — losing every profile the
 * user had. Migration fills the new fields instead, and is deliberately
 * lossless: nothing is removed, only defaulted.
 */
export function migrateProfile(value: unknown): Profile | null {
  if (isProfile(value)) return value;
  if (!isRecord(value)) return null;

  const rules = isRecord(value.rules) ? value.rules : null;
  if (!rules) return null;

  const migrated = {
    ...value,
    alwaysOn: typeof value.alwaysOn === "boolean" ? value.alwaysOn : false,
    rules: {
      ...rules,
      requestHeaders: migrateHeaderRules(rules.requestHeaders),
      responseHeaders: migrateHeaderRules(rules.responseHeaders),
      cookies: migrateCookieRules(rules.cookies, "set"),
      setCookies: migrateCookieRules(rules.setCookies, "set"),
      csp: Array.isArray(rules.csp) ? rules.csp : [],
      redirects: Array.isArray(rules.redirects) ? rules.redirects : [],
    },
    filters: Array.isArray(value.filters) ? value.filters : [],
  };

  return isProfile(migrated) ? (migrated as unknown as Profile) : null;
}

function migrateHeaderRules(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value;
}

/** Cookies gained `writeMode`; everything already stored meant `set`. */
function migrateCookieRules(value: unknown, writeMode: "set" | "append"): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.map((rule) =>
    isRecord(rule) && typeof rule.writeMode === "string" ? rule : { ...rule, writeMode },
  );
}

/** Applied to every profile in a stored state; returns null when nothing can be
 * recovered, which is the caller's signal to fail loudly. */
export function migratePersistedProfiles(value: unknown): PersistedProfile[] | null {
  if (!Array.isArray(value)) return null;
  const migrated = value.map(migrateProfile);
  return migrated.every((profile): profile is Profile => profile !== null) ? migrated : null;
}

/**
 * Migrates the whole `{ state, revision, sourceId }` envelope, keeping the
 * revision untouched so open windows do not fight over the migrated copy.
 */
export function migrateProfileDocument(value: unknown): ProfileDocument | null {
  if (!isRecord(value)) return null;
  const state = value.state;
  if (!isRecord(state)) return null;

  const profiles = migratePersistedProfiles(state.profiles);
  if (!profiles) return null;

  const selectedProfileId = state.selectedProfileId;
  const selected =
    typeof selectedProfileId === "string" && profiles.some((p) => p.id === selectedProfileId)
      ? selectedProfileId
      : (profiles[0]?.id ?? null);
  if (profiles.length === 0) return null;

  return createProfileDocument(
    { profiles, selectedProfileId: selected },
    typeof value.sourceId === "string" ? value.sourceId : "",
    typeof value.revision === "number" && Number.isInteger(value.revision) && value.revision >= 0
      ? value.revision
      : 0,
    // `isPaused` lives inside the persisted state object, matching
    // `toPersistedState`, so it is read from there rather than the envelope.
    typeof state.isPaused === "boolean" ? state.isPaused : false,
  );
}
