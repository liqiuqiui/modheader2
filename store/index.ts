import { storage } from "wxt/utils/storage";
import { nanoid } from "nanoid";
import type { Profile, AppState } from "../types";
import { createHeaderRule } from "../types";
import { randomColor, getTextColor, getShortTitle } from "../utils/color";
import i18n from "../i18n";
import type { Locale } from "../config/locales";

// ─── Storage Items ────────────────────────────────────────────────────────

export const profilesStorage = storage.defineItem<Profile[]>("local:profiles", {
  defaultValue: [],
});

export const selectedIndexStorage = storage.defineItem<number>("local:selectedIndex", {
  defaultValue: 0,
});

// ─── Helpers ──────────────────────────────────────────────────────────────

export function createProfile(num: number, locale: Locale = "zh-CN"): Profile {
  const bg = randomColor();
  return {
    id: nanoid(),
    version: 2,
    title: i18n.getFixedT(locale)("profile.defaultName", { number: num }),
    shortTitle: getShortTitle(String(num)),
    backgroundColor: bg,
    textColor: getTextColor(bg),
    enabled: true,
    paused: false,
    hideComment: true,
    filterOrder: [],
    headers: [createHeaderRule()],
    respHeaders: [],
    cookies: [],
    urlReplacements: [],
    urlFilters: [],
    excludeUrlFilters: [],
    initiatorDomainFilters: [],
    resourceFilters: [],
    tabFilters: [],
    methodFilters: [],
    timeFilters: [],
  };
}

/** 兼容早期保存的 Profile，保证新增字段始终可安全读取。 */
export function normalizeProfile(profile: Profile): Profile {
  return {
    ...profile,
    version: 2,
    enabled: profile.enabled ?? true,
    paused: profile.paused ?? false,
    hideComment: profile.hideComment ?? true,
    filterOrder: profile.filterOrder ?? [],
    headers: (profile.headers ?? []).map((rule) => ({
      ...rule,
      comment: rule.comment ?? "",
      appendMode: rule.appendMode ?? "override",
      sendEmptyHeader: rule.sendEmptyHeader ?? false,
    })),
    respHeaders: (profile.respHeaders ?? []).map((rule) => ({
      ...rule,
      comment: rule.comment ?? "",
      appendMode: rule.appendMode ?? "override",
      sendEmptyHeader: rule.sendEmptyHeader ?? false,
    })),
    cookies: (profile.cookies ?? []).map((cookie) => ({
      ...cookie,
      comment: cookie.comment ?? "",
    })),
    urlReplacements: profile.urlReplacements ?? [],
    urlFilters: (profile.urlFilters ?? []).map((filter) => ({
      ...filter,
      matchType: filter.matchType ?? "regex",
    })),
    excludeUrlFilters: (profile.excludeUrlFilters ?? []).map((filter) => ({
      ...filter,
      matchType: filter.matchType ?? "regex",
    })),
    initiatorDomainFilters: profile.initiatorDomainFilters ?? [],
    resourceFilters: profile.resourceFilters ?? [],
    tabFilters: profile.tabFilters ?? [],
    methodFilters: profile.methodFilters ?? [],
    timeFilters: profile.timeFilters ?? [],
  };
}

export function normalizeProfiles(profiles: Profile[] | undefined | null): Profile[] {
  return (profiles ?? []).map(normalizeProfile);
}

export async function loadState(): Promise<AppState> {
  const [profiles, selectedProfileIndex] = await Promise.all([
    profilesStorage.getValue(),
    selectedIndexStorage.getValue(),
  ]);

  let profs = normalizeProfiles(profiles);
  if (!profs || profs.length === 0) {
    profs = [createProfile(1)];
    await profilesStorage.setValue(profs);
  }

  const idx = Math.max(0, Math.min(selectedProfileIndex, profs.length - 1));
  return { profiles: profs, selectedProfileIndex: idx };
}

export async function saveProfiles(profiles: Profile[], selectedIndex: number) {
  await Promise.all([
    profilesStorage.setValue(profiles),
    selectedIndexStorage.setValue(selectedIndex),
  ]);
}

export async function addProfile(
  profiles: Profile[],
  locale: Locale = "zh-CN",
): Promise<{ profiles: Profile[]; index: number }> {
  const num = profiles.length + 1;
  const newProfile = createProfile(num, locale);
  const updated = [...profiles, newProfile];
  const index = updated.length - 1;
  await saveProfiles(updated, index);
  return { profiles: updated, index };
}

export async function deleteProfile(
  profiles: Profile[],
  index: number,
): Promise<{ profiles: Profile[]; index: number }> {
  const updated = profiles.filter((_, i) => i !== index);
  if (updated.length === 0) {
    updated.push(createProfile(1));
  }
  const newIndex = Math.max(0, Math.min(index, updated.length - 1));
  await saveProfiles(updated, newIndex);
  return { profiles: updated, index: newIndex };
}

export async function cloneProfile(
  profiles: Profile[],
  index: number,
  locale: Locale = "zh-CN",
): Promise<{ profiles: Profile[]; index: number }> {
  const original = profiles[index];
  const bg = randomColor();
  const cloned: Profile = {
    ...JSON.parse(JSON.stringify(original)),
    id: nanoid(),
    title: i18n.getFixedT(locale)("profile.copyName", { title: original.title }),
    shortTitle: getShortTitle(original.shortTitle),
    backgroundColor: bg,
    textColor: getTextColor(bg),
  };
  const updated = [...profiles, cloned];
  const newIndex = updated.length - 1;
  await saveProfiles(updated, newIndex);
  return { profiles: updated, index: newIndex };
}

export async function updateProfile(
  profiles: Profile[],
  index: number,
  patch: Partial<Profile>,
): Promise<Profile[]> {
  const updated = profiles.map((p, i) => {
    if (i !== index) return p;
    const merged = { ...p, ...patch };
    // Keep shortTitle in sync
    if (patch.title !== undefined) {
      merged.shortTitle = getShortTitle(patch.title);
    }
    return merged;
  });
  await profilesStorage.setValue(updated);
  return updated;
}
