import { nanoid } from "nanoid";
import type {
  CookieRule,
  CspRule,
  HeaderRule,
  Profile,
  ProfileFilter,
  ProfileRules,
  UrlReplacementRule,
} from "./profile-model";

type CollectionRule = HeaderRule | CspRule | CookieRule | UrlReplacementRule;

/**
 * Identity of a rule for merge purposes: two rules that would produce the same
 * effect are the same rule, so merging does not create duplicates. Editor ids
 * are deliberately excluded.
 */
function ruleFingerprint(rule: CollectionRule): string {
  if ("appendMode" in rule) {
    return [
      "header",
      rule.enabled,
      rule.name.trim(),
      rule.value,
      rule.comment,
      rule.appendMode,
      rule.sendEmptyHeader,
    ].join("|");
  }
  if ("writeMode" in rule) {
    return [
      "cookie",
      rule.enabled,
      rule.name.trim(),
      rule.value,
      rule.comment,
      rule.writeMode,
    ].join("|");
  }
  if ("directive" in rule) {
    return ["csp", rule.enabled, rule.directive.trim(), rule.value, rule.comment].join("|");
  }
  return ["url", rule.enabled, rule.name.trim(), rule.value, rule.comment].join("|");
}

function filterFingerprint(filter: ProfileFilter): string {
  return [filter.enabled, filter.kind, filter.mode, filter.value, filter.comment].join("|");
}

/** Returns the original array when nothing was added, so callers can detect a
 * no-op merge by reference equality. */
function mergeCollection<Rule extends CollectionRule>(
  target: Rule[],
  source: Rule[] | undefined,
): Rule[] {
  if (!Array.isArray(source) || source.length === 0) return target;
  const seen = new Set(target.map(ruleFingerprint));
  const additions: Rule[] = [];
  for (const rule of source) {
    const fingerprint = ruleFingerprint(rule);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    additions.push({ ...structuredClone(rule), id: nanoid() } as Rule);
  }
  return additions.length > 0 ? [...target, ...additions] : target;
}

function mergeFilters(
  target: ProfileFilter[],
  source: ProfileFilter[] | undefined,
): ProfileFilter[] {
  if (!Array.isArray(source) || source.length === 0) return target;
  const seen = new Set(target.map(filterFingerprint));
  const additions: ProfileFilter[] = [];
  for (const filter of source) {
    const fingerprint = filterFingerprint(filter);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    additions.push({ ...structuredClone(filter), id: nanoid() });
  }
  return additions.length > 0 ? [...target, ...additions] : target;
}

/**
 * Folds `source` into `target`: rules and filters with an identical effect are
 * skipped, everything else is appended with a fresh id. The target keeps its own
 * title, colour and enabled state — merging must not silently restyle or disable
 * the profile the user is working in.
 */
export function mergeProfileInto(target: Profile, source: Profile): Profile {
  if (!isMergeableProfile(source)) return target;

  // Written out per collection rather than looped: TypeScript cannot prove that
  // assigning through a `keyof ProfileRules` key keeps the per-key array types.
  const targetRules = target.rules;
  const sourceRules = source.rules as Partial<ProfileRules>;
  const requestHeaders = mergeCollection(targetRules.requestHeaders, sourceRules.requestHeaders);
  const responseHeaders = mergeCollection(targetRules.responseHeaders, sourceRules.responseHeaders);
  const csp = mergeCollection(targetRules.csp, sourceRules.csp);
  const cookies = mergeCollection(targetRules.cookies, sourceRules.cookies);
  const setCookies = mergeCollection(targetRules.setCookies, sourceRules.setCookies);
  const redirects = mergeCollection(targetRules.redirects, sourceRules.redirects);
  const filters = mergeFilters(target.filters, source.filters);

  if (
    requestHeaders === targetRules.requestHeaders &&
    responseHeaders === targetRules.responseHeaders &&
    csp === targetRules.csp &&
    cookies === targetRules.cookies &&
    setCookies === targetRules.setCookies &&
    redirects === targetRules.redirects &&
    filters === target.filters
  ) {
    return target;
  }

  return {
    ...target,
    rules: { requestHeaders, responseHeaders, csp, cookies, setCookies, redirects },
    filters,
  };
}

/** Guards against a hand-edited payload reaching the typed merge path; the
 * command protocol already validates, this keeps the function safe alone. */
function isMergeableProfile(value: Profile): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "rules" in value &&
    typeof value.rules === "object" &&
    value.rules !== null
  );
}
