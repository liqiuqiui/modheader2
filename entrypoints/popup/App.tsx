import React, { useEffect, useState, useCallback } from "react";
import { browser } from "wxt/browser";
import { Pause, Play, Settings, Plus, Trash2, ChevronDown, ChevronRight, Languages } from "lucide-react";
import {
  profilesStorage, selectedIndexStorage, isPausedStorage,
  loadState, addProfile, deleteProfile, updateProfile,
} from "../../store";
import {
  createHeaderRule, createUrlFilter, createTabFilter,
} from "../../types";
import type { AppState, HeaderRule, UrlFilter, TabFilter, Profile } from "../../types";
import { Switch } from "../../components/ui/switch";
import { TabPicker, type BrowserTab } from "../../components/TabPicker";
import { useTranslation } from "react-i18next";

export default function App() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "en" ? "en" : "zh-CN";
  const [state, setState] = useState<AppState>({ profiles: [], selectedProfileIndex: 0, isPaused: false });
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    respHeaders: false, urlFilters: false, excludeUrlFilters: false, tabFilters: false,
  });

  useEffect(() => {
    loadState().then((s) => { setState(s); setLoaded(true); });
    const u1 = profilesStorage.watch((p) => setState((s) => ({ ...s, profiles: p ?? [] })));
    const u2 = selectedIndexStorage.watch((i) => setState((s) => ({ ...s, selectedProfileIndex: i })));
    const u3 = isPausedStorage.watch((v) => setState((s) => ({ ...s, isPaused: v })));
    return () => { u1(); u2(); u3(); };
  }, []);

  const profile = state.profiles[state.selectedProfileIndex];

  const patch = useCallback(async (changes: Partial<Profile>) => {
    const updated = await updateProfile(state.profiles, state.selectedProfileIndex, changes);
    setState((s) => ({ ...s, profiles: updated }));
  }, [state.profiles, state.selectedProfileIndex]);

  const handleSelectProfile = async (i: number) => {
    await selectedIndexStorage.setValue(i);
    setState((s) => ({ ...s, selectedProfileIndex: i }));
  };
  const handleTogglePause = async () => {
    const next = !state.isPaused;
    await isPausedStorage.setValue(next);
    setState((s) => ({ ...s, isPaused: next }));
  };
  const handleAddProfile = async () => {
    const { profiles, index } = await addProfile(state.profiles, locale);
    setState((s) => ({ ...s, profiles, selectedProfileIndex: index }));
  };
  const handleDeleteProfile = async (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const { profiles, index } = await deleteProfile(state.profiles, i);
    setState((s) => ({ ...s, profiles, selectedProfileIndex: index }));
  };
  const handleOpenOptions = () => { browser.runtime.openOptionsPage(); window.close(); };

  const toggle = (key: string) => setExpanded((e) => ({ ...e, [key]: !e[key] }));

  if (!loaded) return <div className="flex h-[580px] w-[780px] items-center justify-center bg-slate-50 text-sm text-slate-400">{t("common.loading")}</div>;

  const bg = profile?.backgroundColor ?? "#3b82f6";
  const fg = profile?.textColor ?? "white";

  return (
    <div className="flex h-[580px] w-[780px] flex-col overflow-hidden bg-slate-50" style={{ fontFamily: "system-ui,sans-serif", fontSize: 13 }}>
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: bg, color: fg, minHeight: 56 }}>
        <div className="flex flex-1 items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {state.profiles.map((p, i) => (
            <button
              key={p.id}
              onClick={() => handleSelectProfile(i)}
              onContextMenu={(e) => { e.preventDefault(); handleDeleteProfile(i, e); }}
              title={p.title}
              style={{
                backgroundColor: p.backgroundColor, color: p.textColor,
                border: `2px solid ${i === state.selectedProfileIndex ? "white" : "transparent"}`,
                boxShadow: i === state.selectedProfileIndex ? "0 0 0 1px rgba(0,0,0,0.25)" : "none",
              }}
              className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-xs font-bold transition-all"
            >
              {p.shortTitle}
            </button>
          ))}
          <button onClick={handleAddProfile} title={t("profile.add")} style={{ color: fg }}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity hover:bg-black/10 hover:opacity-100">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <span className="mx-2 max-w-[220px] truncate text-sm font-semibold" style={{ color: fg }}>{profile?.title}</span>
        <button onClick={handleTogglePause} title={state.isPaused ? t("toolbar.resume") : t("toolbar.pause")} style={{ color: fg }}
          className="flex-shrink-0 rounded-lg p-2 transition-colors hover:bg-black/10">
          {state.isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
        </button>
        <button
          onClick={() => void i18n.changeLanguage(locale === "zh-CN" ? "en" : "zh-CN")}
          title={t("common.language")}
          style={{ color: fg }}
          className="flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold transition-colors hover:bg-black/10"
        >
          <Languages className="h-4 w-4" />
          {locale === "zh-CN" ? "EN" : "中"}
        </button>
        <button onClick={handleOpenOptions} title={t("toolbar.settings")} style={{ color: fg }}
          className="flex-shrink-0 rounded-lg p-2 transition-colors hover:bg-black/10">
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {state.isPaused && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-700">
          {t("toolbar.paused")}
        </div>
      )}

      {profile && (
        <div className="flex-1 overflow-y-auto divide-y divide-slate-200/70">
          {/* Request Headers — always expanded */}
          <HeaderSection
            title={t("section.requestHeaders")}
            rules={profile.headers}
            alwaysOpen
            onAdd={() => patch({ headers: [...profile.headers, createHeaderRule()] })}
            onPatch={(id, p) => patch({ headers: profile.headers.map((r) => r.id === id ? { ...r, ...p } : r) })}
            onDelete={(id) => patch({ headers: profile.headers.filter((r) => r.id !== id) })}
          />

          {/* Response Headers */}
          <HeaderSection
            title={t("section.responseHeaders")}
            rules={profile.respHeaders}
            open={expanded.respHeaders}
            onToggle={() => toggle("respHeaders")}
            onAdd={() => patch({ respHeaders: [...profile.respHeaders, createHeaderRule()] })}
            onPatch={(id, p) => patch({ respHeaders: profile.respHeaders.map((r) => r.id === id ? { ...r, ...p } : r) })}
            onDelete={(id) => patch({ respHeaders: profile.respHeaders.filter((r) => r.id !== id) })}
          />

          {/* URL Filters */}
          <FilterSection
            title={t("section.urlFilters")}
            hint={t("filter.urlIncludeHint")}
            items={profile.urlFilters}
            open={expanded.urlFilters}
            onToggle={() => toggle("urlFilters")}
            onAdd={() => patch({ urlFilters: [...profile.urlFilters, createUrlFilter()] })}
            onPatch={(id, p) => patch({ urlFilters: profile.urlFilters.map((r) => r.id === id ? { ...r, ...p } : r) })}
            onDelete={(id) => patch({ urlFilters: profile.urlFilters.filter((r) => r.id !== id) })}
            placeholder="e.g. https://api\\.example\\.com/.*"
          />

          {/* Exclude URL Filters */}
          <FilterSection
            title={t("section.excludeUrlFilters")}
            hint={t("filter.urlExcludeHint")}
            items={profile.excludeUrlFilters}
            open={expanded.excludeUrlFilters}
            onToggle={() => toggle("excludeUrlFilters")}
            onAdd={() => patch({ excludeUrlFilters: [...profile.excludeUrlFilters, createUrlFilter()] })}
            onPatch={(id, p) => patch({ excludeUrlFilters: profile.excludeUrlFilters.map((r) => r.id === id ? { ...r, ...p } : r) })}
            onDelete={(id) => patch({ excludeUrlFilters: profile.excludeUrlFilters.filter((r) => r.id !== id) })}
            placeholder="e.g. .*\\.png$"
          />

          {/* Tab Filters */}
          <TabFilterSection
            items={profile.tabFilters}
            open={expanded.tabFilters}
            onToggle={() => toggle("tabFilters")}
            onAdd={() => patch({ tabFilters: [...profile.tabFilters, createTabFilter()] })}
            onPatch={(id, p) => patch({ tabFilters: profile.tabFilters.map((r) => r.id === id ? { ...r, ...p } : r) })}
            onDelete={(id) => patch({ tabFilters: profile.tabFilters.filter((r) => r.id !== id) })}
          />
        </div>
      )}
    </div>
  );
}

// ── HeaderSection ──────────────────────────────────────────────────────────

interface HeaderSectionProps {
  title: string;
  rules: HeaderRule[];
  open?: boolean;
  alwaysOpen?: boolean;
  onToggle?: () => void;
  onAdd: () => void;
  onPatch: (id: string, patch: Partial<HeaderRule>) => void;
  onDelete: (id: string) => void;
}

function HeaderSection({ title, rules, open, alwaysOpen, onToggle, onAdd, onPatch, onDelete }: HeaderSectionProps) {
  const { t } = useTranslation();
  const isOpen = alwaysOpen || open;
  const badge = rules.length > 0 ? rules.length : null;

  return (
    <div>
      {!alwaysOpen && (
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-between bg-slate-100/80 px-5 py-3 transition-colors hover:bg-slate-100"
        >
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {title}
            {badge && <span className="text-xs font-normal text-slate-400">· {badge}</span>}
          </span>
        </button>
      )}
      {alwaysOpen && (
        <div className="border-b border-slate-200 bg-slate-100/80 px-5 py-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</span>
        </div>
      )}
      {isOpen && (
        <>
          {rules.length === 0 && (
            <div className="mx-5 my-4 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 text-center text-sm italic text-slate-400">{t("section.noRulesShort")}</div>
          )}
          {rules.map((rule) => (
            <div key={rule.id} className="group mx-5 my-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-slate-300">
              <Switch
                checked={rule.enabled}
                onCheckedChange={(v) => onPatch(rule.id, { enabled: v })}
                className="flex-shrink-0"
              />
              <input
                className="h-10 min-w-0 flex-[0.8] rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm outline-none transition hover:bg-white focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                placeholder={t("header.namePlaceholder")}
                aria-label={t("header.name")}
                value={rule.name}
                onChange={(e) => onPatch(rule.id, { name: e.target.value })}
                spellCheck={false}
              />
              <input
                className="h-10 min-w-0 flex-[1.4] rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm outline-none transition hover:bg-white focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                placeholder={t("header.valuePlaceholder")}
                aria-label={t("header.value")}
                value={rule.value}
                onChange={(e) => onPatch(rule.id, { value: e.target.value })}
                spellCheck={false}
              />
              <button
                onClick={() => onDelete(rule.id)}
                aria-label={t("header.delete")}
                className="flex-shrink-0 rounded-lg p-2 text-slate-400 opacity-60 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={onAdd}
            className="flex w-full items-center gap-2 px-5 py-3 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" /> {t("section.add", { title })}
          </button>
        </>
      )}
    </div>
  );
}

// ── FilterSection (URL regex) ──────────────────────────────────────────────

interface FilterSectionProps {
  title: string;
  hint: string;
  items: UrlFilter[];
  open?: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onPatch: (id: string, patch: Partial<UrlFilter>) => void;
  onDelete: (id: string) => void;
  placeholder: string;
}

function FilterSection({ title, hint, items, open, onToggle, onAdd, onPatch, onDelete, placeholder }: FilterSectionProps) {
  const { t } = useTranslation();
  const badge = items.length > 0 ? items.length : null;

  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between bg-slate-100/80 px-5 py-3 transition-colors hover:bg-slate-100"
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {title}
          {badge && <span className="text-xs font-normal text-slate-400">· {badge}</span>}
        </span>
        {!open && badge && (
          <span className="max-w-[300px] truncate font-mono text-xs text-slate-400">
            {items[0].urlRegex}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="mx-5 mt-4 rounded-lg bg-slate-100 px-4 py-3 text-xs italic text-slate-500">{hint}</div>
          {items.map((item) => (
            <div key={item.id} className="group mx-5 my-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-slate-300">
              <Switch
                checked={item.enabled}
                onCheckedChange={(v) => onPatch(item.id, { enabled: v })}
                className="flex-shrink-0"
              />
              <input
                className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm outline-none transition hover:bg-white focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                placeholder={placeholder}
                aria-label={title}
                value={item.urlRegex}
                onChange={(e) => onPatch(item.id, { urlRegex: e.target.value })}
                spellCheck={false}
              />
              <button
                onClick={() => onDelete(item.id)}
                aria-label={t("filter.delete")}
                className="flex-shrink-0 rounded-lg p-2 text-slate-400 opacity-60 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={onAdd}
            className="flex w-full items-center gap-2 px-5 py-3 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" /> {t("filter.add")}
          </button>
        </>
      )}
    </div>
  );
}

// ── TabFilterSection ───────────────────────────────────────────────────────

interface TabFilterSectionProps {
  items: TabFilter[];
  open?: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onPatch: (id: string, patch: Partial<TabFilter>) => void;
  onDelete: (id: string) => void;
}

function TabFilterSection({ items, open, onToggle, onAdd, onPatch, onDelete }: TabFilterSectionProps) {
  const { t } = useTranslation();
  const badge = items.length > 0 ? items.length : null;
  const [tabs, setTabs] = useState<BrowserTab[]>([]);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const nextTabs = await browser.tabs.query({});
      if (alive) setTabs(nextTabs.sort((left, right) => Number(right.active) - Number(left.active)));
    };
    void refresh();
    browser.tabs.onCreated.addListener(refresh);
    browser.tabs.onUpdated.addListener(refresh);
    browser.tabs.onRemoved.addListener(refresh);
    browser.tabs.onActivated.addListener(refresh);
    return () => {
      alive = false;
      browser.tabs.onCreated.removeListener(refresh);
      browser.tabs.onUpdated.removeListener(refresh);
      browser.tabs.onRemoved.removeListener(refresh);
      browser.tabs.onActivated.removeListener(refresh);
    };
  }, []);

  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between bg-slate-100/80 px-5 py-3 transition-colors hover:bg-slate-100"
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {t("section.tabFilters")}
          {badge && <span className="text-xs font-normal text-slate-400">· {badge}</span>}
        </span>
      </button>
      {open && (
        <>
          <div className="mx-5 mt-4 rounded-lg bg-slate-100 px-4 py-3 text-xs italic text-slate-500">
            {t("filter.tabHint")}
          </div>
          {items.map((item) => (
            <div key={item.id} className="group mx-5 my-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-slate-300">
              <Switch
                checked={item.enabled}
                onCheckedChange={(v) => onPatch(item.id, { enabled: v })}
                className="flex-shrink-0"
              />
              <TabPicker
                value={item.tabId}
                tabs={tabs}
                onChange={(tabId) => onPatch(item.id, { tabId })}
              />
              <button
                onClick={() => onDelete(item.id)}
                aria-label={t("filter.delete")}
                className="flex-shrink-0 rounded-lg p-2 text-slate-400 opacity-60 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={onAdd}
            className="flex w-full items-center gap-2 px-5 py-3 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" /> {t("section.add", { title: t("section.tabFilters") })}
          </button>
        </>
      )}
    </div>
  );
}
