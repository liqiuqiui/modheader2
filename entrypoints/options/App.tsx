import React, { useEffect, useMemo, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { browser } from "wxt/browser";
import {
  ArrowDownToLine,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  FileDown,
  FileUp,
  Filter,
  Globe2,
  GripVertical,
  HelpCircle,
  Languages,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Pause,
  Play,
  Plus,
  Redo2,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  addProfile,
  cloneProfile,
  deleteProfile,
  isPausedStorage,
  loadState,
  normalizeProfiles,
  profilesStorage,
  saveProfiles,
  selectedIndexStorage,
  updateProfile,
} from "../../store";
import {
  createDomainFilter,
  createCookieRule,
  createHeaderRule,
  createMethodFilter,
  createResourceFilter,
  createTabFilter,
  createUrlFilter,
  createUrlReplacement,
} from "../../types";
import type {
  AppState,
  CookieRule,
  HeaderRule,
  Profile,
  RequestMethod,
  UrlReplacement,
} from "../../types";
import { HeaderRuleRow } from "../../components/HeaderRuleRow";
import { Switch } from "../../components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { TabPicker, type BrowserTab } from "../../components/TabPicker";
import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";

type FilterKind = "urlPattern" | "urlRegex" | "tab" | "resourceType" | "method" | "initiator";
type FilterMode = "include" | "exclude";

interface FilterView {
  id: string;
  enabled: boolean;
  kind: FilterKind;
  mode: FilterMode;
  value: string | number;
  comment: string;
}

interface HistorySnapshot {
  profiles: Profile[];
  selectedIndex: number;
}

const FILTER_LABEL_KEYS: Record<FilterKind, ParseKeys> = {
  urlPattern: "filter.urlPattern",
  urlRegex: "filter.urlRegex",
  tab: "filter.tab",
  resourceType: "filter.resourceType",
  method: "filter.method",
  initiator: "filter.initiator",
};

const RESOURCE_TYPES = [
  ["main_frame", "resource.mainFrame"],
  ["sub_frame", "resource.subFrame"],
  ["xmlhttprequest", "resource.xhr"],
  ["script", "resource.script"],
  ["stylesheet", "resource.stylesheet"],
  ["image", "resource.image"],
  ["font", "resource.font"],
  ["media", "resource.media"],
  ["object", "resource.object"],
  ["other", "resource.other"],
] as const;

const METHODS: RequestMethod[] = ["get", "post", "put", "patch", "delete", "head", "options", "connect"];
const SIDEBAR_COLLAPSED_KEY = "modheader-v2:sidebar-collapsed";

const menuItemClass =
  "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-slate-700 outline-none transition data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 hover:bg-slate-100 focus:bg-slate-100";

function iconButtonClass(disabled = false) {
  return `rounded-lg p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
    disabled ? "cursor-not-allowed opacity-35" : "hover:bg-black/10"
  }`;
}

function profileFilters(profile: Profile): FilterView[] {
  return [
    ...(profile.urlFilters ?? []).map((filter): FilterView => ({
      id: filter.id,
      enabled: filter.enabled,
      kind: filter.matchType === "regex" ? "urlRegex" : "urlPattern",
      mode: "include",
      value: filter.urlRegex,
      comment: filter.comment,
    })),
    ...(profile.excludeUrlFilters ?? []).map((filter): FilterView => ({
      id: filter.id,
      enabled: filter.enabled,
      kind: filter.matchType === "regex" ? "urlRegex" : "urlPattern",
      mode: "exclude",
      value: filter.urlRegex,
      comment: filter.comment,
    })),
    ...(profile.tabFilters ?? []).map((filter): FilterView => ({
      id: filter.id,
      enabled: filter.enabled,
      kind: "tab",
      mode: filter.exclude ? "exclude" : "include",
      value: filter.tabId,
      comment: filter.comment,
    })),
    ...(profile.resourceFilters ?? []).map((filter): FilterView => ({
      id: filter.id,
      enabled: filter.enabled,
      kind: "resourceType",
      mode: filter.exclude ? "exclude" : "include",
      value: filter.resourceType[0] ?? "xmlhttprequest",
      comment: filter.comment,
    })),
    ...(profile.methodFilters ?? []).map((filter): FilterView => ({
      id: filter.id,
      enabled: filter.enabled,
      kind: "method",
      mode: filter.exclude ? "exclude" : "include",
      value: filter.method,
      comment: filter.comment,
    })),
    ...(profile.initiatorDomainFilters ?? []).map((filter): FilterView => ({
      id: filter.id,
      enabled: filter.enabled,
      kind: "initiator",
      mode: filter.exclude ? "exclude" : "include",
      value: filter.domain,
      comment: filter.comment,
    })),
  ];
}

function SectionHeader({
  title,
  count,
  open,
  enabled,
  onToggle,
  onToggleEnabled,
  onAdd,
  onClear,
}: {
  title: string;
  count: number;
  open: boolean;
  enabled: boolean;
  onToggle: () => void;
  onToggleEnabled: () => void;
  onAdd: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 px-1 py-2">
      <button
        type="button"
        aria-label={enabled ? t("section.disableAll", { title }) : t("section.enableAll", { title })}
        onClick={onToggleEnabled}
        className={`flex h-4 w-4 items-center justify-center rounded border transition ${
          enabled ? "border-[var(--theme-color)] bg-[var(--theme-color)] text-white" : "border-slate-300 bg-white text-transparent"
        }`}
      >
        <Check aria-hidden="true" className="h-3 w-3" />
      </button>
      <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={onToggle}>
        {open ? <ChevronDown aria-hidden="true" className="h-4 w-4 text-slate-400" /> : <ChevronRight aria-hidden="true" className="h-4 w-4 text-slate-400" />}
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{title}</span>
        <span className="text-[11px] text-slate-400">· {count}</span>
      </button>
      <button type="button" aria-label={t("section.add", { title })} onClick={onAdd} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-[var(--theme-color)]">
        <Plus aria-hidden="true" className="h-4 w-4" />
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" aria-label={t("section.more", { title })} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700">
            <MoreVertical aria-hidden="true" className="h-4 w-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className="z-[100] min-w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            <DropdownMenu.Item className={`${menuItemClass} text-rose-600`} onSelect={onClear} disabled={count === 0}>
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> {t("section.clear")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function HeaderSection({
  title,
  rules,
  searchQuery,
  onChange,
  focusRuleId,
  convertLabel,
  onConvertRule,
  compact = false,
}: {
  title: string;
  rules: HeaderRule[];
  searchQuery: string;
  onChange: (rules: HeaderRule[]) => void;
  focusRuleId?: string | null;
  convertLabel?: string;
  onConvertRule?: (rule: HeaderRule) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const [localFocusRuleId, setLocalFocusRuleId] = useState<string | null>(null);
  const visibleRules = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rules;
    return rules.filter((rule) => `${rule.name} ${rule.value} ${rule.comment}`.toLowerCase().includes(query));
  }, [rules, searchQuery]);

  const enabled = rules.length > 0 && rules.some((rule) => rule.enabled);
  return (
    <section>
      <SectionHeader
        title={title}
        count={rules.length}
        open={open}
        enabled={enabled}
        onToggle={() => setOpen((current) => !current)}
        onToggleEnabled={() => onChange(rules.map((rule) => ({ ...rule, enabled: !enabled })))}
        onAdd={() => {
          const nextRule = createHeaderRule();
          setLocalFocusRuleId(nextRule.id);
          onChange([...rules, nextRule]);
          setOpen(true);
        }}
        onClear={() => onChange([])}
      />
      {open && (
        <div className={compact ? "space-y-1.5" : "space-y-2"}>
          {visibleRules.map((rule) => (
            <HeaderRuleRow
              key={rule.id}
              rule={rule}
              autoFocus={rule.id === focusRuleId || rule.id === localFocusRuleId}
              onChange={(patch) => onChange(rules.map((item) => item.id === rule.id ? { ...item, ...patch } : item))}
              onDelete={() => onChange(rules.filter((item) => item.id !== rule.id))}
              onClone={() => {
                const clone = { ...rule, id: createHeaderRule().id };
                setLocalFocusRuleId(clone.id);
                onChange([...rules, clone]);
                setOpen(true);
              }}
              convertLabel={convertLabel}
              onConvert={onConvertRule ? () => onConvertRule(rule) : undefined}
              compact={compact}
            />
          ))}
          {!compact && rules.length === 0 && <EmptyState label={t("section.noRules", { title })} />}
          {rules.length > 0 && visibleRules.length === 0 && <EmptyState label={t("section.noMatchedRules")} />}
        </div>
      )}
    </section>
  );
}

function CookieSection({
  cookies,
  searchQuery,
  onChange,
  focusCookieId,
  compact = false,
}: {
  cookies: CookieRule[];
  searchQuery: string;
  onChange: (cookies: CookieRule[]) => void;
  focusCookieId?: string | null;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const [localFocusCookieId, setLocalFocusCookieId] = useState<string | null>(null);
  const query = searchQuery.trim().toLowerCase();
  const visibleCookies = cookies.filter((cookie) => !query || `${cookie.name} ${cookie.value} ${cookie.comment}`.toLowerCase().includes(query));
  const enabled = cookies.length > 0 && cookies.some((cookie) => cookie.enabled);

  return (
    <section>
      <SectionHeader
        title={t("section.cookies")}
        count={cookies.length}
        open={open}
        enabled={enabled}
        onToggle={() => setOpen((current) => !current)}
        onToggleEnabled={() => onChange(cookies.map((cookie) => ({ ...cookie, enabled: !enabled })))}
        onAdd={() => {
          const cookie = createCookieRule();
          setLocalFocusCookieId(cookie.id);
          onChange([...cookies, cookie]);
          setOpen(true);
        }}
        onClear={() => onChange([])}
      />
      {open && (
        <div className={compact ? "space-y-1.5" : "space-y-2"}>
          {visibleCookies.map((cookie) => (
            <div key={cookie.id} className={`group flex items-center gap-2 rounded-lg border border-slate-200 bg-white ${compact ? "p-1.5 shadow-sm" : "p-2.5 shadow-sm"} ${cookie.enabled ? "" : "opacity-60"}`}>
              <Switch
                checked={cookie.enabled}
                onCheckedChange={(enabled) => onChange(cookies.map((item) => item.id === cookie.id ? { ...item, enabled } : item))}
                aria-label={t("cookie.enable")}
                className="shrink-0"
              />
              <input
                aria-label={t("cookie.name")}
                className={`${compact ? "h-8" : "h-9"} min-w-0 flex-[0.85] rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs font-semibold outline-none transition hover:bg-white focus:ring-2 focus:ring-[var(--theme-color)]`}
                placeholder={t("cookie.namePlaceholder")}
                value={cookie.name}
                autoFocus={cookie.id === focusCookieId || cookie.id === localFocusCookieId}
                onChange={(event) => onChange(cookies.map((item) => item.id === cookie.id ? { ...item, name: event.target.value } : item))}
                spellCheck={false}
              />
              <input
                aria-label={t("cookie.value")}
                className={`${compact ? "h-8" : "h-9"} min-w-0 flex-[1.4] rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs outline-none transition hover:bg-white focus:ring-2 focus:ring-[var(--theme-color)]`}
                placeholder={t("cookie.valuePlaceholder")}
                value={cookie.value}
                onChange={(event) => onChange(cookies.map((item) => item.id === cookie.id ? { ...item, value: event.target.value } : item))}
                spellCheck={false}
              />
              <button type="button" aria-label={t("cookie.delete")} onClick={() => onChange(cookies.filter((item) => item.id !== cookie.id))} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button type="button" aria-label={t("common.more")} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><MoreHorizontal aria-hidden="true" className="h-4 w-4" /></button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="end" sideOffset={6} className="z-[100] min-w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <DropdownMenu.Item className={menuItemClass} onSelect={() => {
                      const clone = { ...cookie, id: createCookieRule().id };
                      setLocalFocusCookieId(clone.id);
                      onChange([...cookies, clone]);
                    }}><Copy aria-hidden="true" className="h-3.5 w-3.5" /> {t("cookie.clone")}</DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          ))}
          {!compact && cookies.length === 0 && <EmptyState label={t("section.noRules", { title: t("section.cookies") })} />}
          {cookies.length > 0 && visibleCookies.length === 0 && <EmptyState label={t("section.noMatchedRules")} />}
        </div>
      )}
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-xl border border-dashed border-slate-200 bg-white/50 px-4 py-5 text-center text-xs text-slate-400">{label}</div>;
}

function FilterSelect({
  ariaLabel,
  value,
  options,
  onValueChange,
  className,
  autoFocus,
}: {
  ariaLabel: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={ariaLabel} className={className} autoFocus={autoFocus}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function FilterValueEditor({
  filter,
  tabs,
  onChange,
  autoFocus,
}: {
  filter: FilterView;
  tabs: BrowserTab[];
  onChange: (value: string | number) => void;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  if (filter.kind === "tab") {
    return <TabPicker value={filter.value} tabs={tabs} onChange={onChange} />;
  }
  if (filter.kind === "resourceType") {
    return (
      <FilterSelect
        ariaLabel={t("filter.resourceTypeLabel")}
        value={String(filter.value)}
        autoFocus={autoFocus}
        onValueChange={onChange}
        className="min-w-0 flex-1"
        options={RESOURCE_TYPES.map(([value, labelKey]) => ({ value, label: t(labelKey) }))}
      />
    );
  }
  if (filter.kind === "method") {
    return (
      <FilterSelect
        ariaLabel={t("filter.methodLabel")}
        value={String(filter.value)}
        onValueChange={onChange}
        className="min-w-0 flex-1 font-semibold uppercase"
        options={METHODS.map((method) => ({ value: method, label: method.toUpperCase() }))}
      />
    );
  }

  const placeholder = filter.kind === "initiator"
    ? t("filter.initiatorPlaceholder")
    : filter.kind === "urlRegex"
      ? t("filter.regexPlaceholder")
      : t("filter.patternPlaceholder");
  let invalid = false;
  if (filter.kind === "urlRegex" && String(filter.value)) {
    try {
      new RegExp(String(filter.value));
    } catch {
      invalid = true;
    }
  }
  return (
    <div className="min-w-0 flex-1">
      <input
        aria-label={t(FILTER_LABEL_KEYS[filter.kind])}
        value={String(filter.value)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className={`h-9 w-full rounded-lg border bg-slate-50 px-3 font-mono text-xs text-slate-700 outline-none transition hover:bg-white focus:ring-2 ${
          invalid ? "border-rose-300 focus:ring-rose-500/20" : "border-slate-200 focus:ring-[var(--theme-color)]"
        }`}
      />
      {invalid && <div role="alert" className="mt-1 text-[11px] text-rose-600">{t("filter.invalidRegex")}</div>}
    </div>
  );
}

function FilterRow({
  filter,
  tabs,
  onPatch,
  onKindChange,
  onDelete,
  autoFocusValue,
  compact = false,
}: {
  filter: FilterView;
  tabs: BrowserTab[];
  onPatch: (patch: Partial<FilterView>) => void;
  onKindChange: (kind: FilterKind) => void;
  onDelete: () => void;
  autoFocusValue?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className={`group rounded-lg border bg-white ${compact ? "p-1.5 shadow-sm" : "p-2.5 shadow-sm"} transition ${filter.enabled ? "border-slate-200" : "border-slate-200/70 opacity-60"}`}>
      <div className="flex items-start gap-2">
        <GripVertical aria-hidden="true" className="mt-2 hidden h-4 w-4 shrink-0 cursor-grab text-slate-300 sm:block" />
        <Switch checked={filter.enabled} onCheckedChange={(enabled) => onPatch({ enabled })} aria-label={t("filter.enable")} className="mt-2 shrink-0" />
        <FilterSelect
          ariaLabel={t("filter.modeLabel")}
          value={filter.mode}
          onValueChange={(value) => onPatch({ mode: value as FilterMode })}
          className="w-[84px] shrink-0 font-medium"
          options={[
            { value: "include", label: t("filter.include") },
            { value: "exclude", label: t("filter.exclude") },
          ]}
        />
        <FilterSelect
          ariaLabel={t("filter.typeLabel")}
          value={filter.kind}
          onValueChange={(value) => onKindChange(value as FilterKind)}
          className="w-[122px] shrink-0"
          options={(Object.keys(FILTER_LABEL_KEYS) as FilterKind[]).map((kind) => ({ value: kind, label: t(FILTER_LABEL_KEYS[kind]) }))}
        />
        <FilterValueEditor filter={filter} tabs={tabs} autoFocus={autoFocusValue} onChange={(value) => onPatch({ value })} />
        <button type="button" aria-label={t("filter.delete")} onClick={onDelete} className="mt-0.5 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function FilterSection({
  profile,
  tabs,
  searchQuery,
  onUpdate,
  focusFilterId,
  compact = false,
}: {
  profile: Profile;
  tabs: BrowserTab[];
  searchQuery: string;
  onUpdate: (patch: Partial<Profile>) => void;
  focusFilterId?: string | null;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [draftKind, setDraftKind] = useState<FilterKind>("urlPattern");
  const [draftMode, setDraftMode] = useState<FilterMode>("include");
  const [localFocusFilterId, setLocalFocusFilterId] = useState<string | null>(null);
  const filters = profileFilters(profile);
  const visibleFilters = filters.filter((filter) => {
    const query = searchQuery.trim().toLowerCase();
    return !query || `${t(FILTER_LABEL_KEYS[filter.kind])} ${filter.mode} ${filter.value} ${filter.comment}`.toLowerCase().includes(query);
  });
  const enabled = filters.length > 0 && filters.some((filter) => filter.enabled);
  const activeTab = tabs.find((tab) => tab.active);

  const withoutFilter = (id: string) => ({
    urlFilters: profile.urlFilters.filter((filter) => filter.id !== id),
    excludeUrlFilters: profile.excludeUrlFilters.filter((filter) => filter.id !== id),
    tabFilters: profile.tabFilters.filter((filter) => filter.id !== id),
    resourceFilters: profile.resourceFilters.filter((filter) => filter.id !== id),
    methodFilters: profile.methodFilters.filter((filter) => filter.id !== id),
    initiatorDomainFilters: profile.initiatorDomainFilters.filter((filter) => filter.id !== id),
  });

  const addFilter = (kind: FilterKind, seed?: Partial<FilterView>) => {
    const mode = seed?.mode ?? "include";
    if (kind === "urlPattern" || kind === "urlRegex") {
      const filter = createUrlFilter({ matchType: kind === "urlRegex" ? "regex" : "pattern" });
      setLocalFocusFilterId(filter.id);
      if (mode === "exclude") onUpdate({ excludeUrlFilters: [...profile.excludeUrlFilters, filter] });
      else onUpdate({ urlFilters: [...profile.urlFilters, filter] });
    } else if (kind === "tab") {
      const activeTab = tabs.find((tab) => tab.active)?.id ?? "";
      onUpdate({ tabFilters: [...profile.tabFilters, createTabFilter({ tabId: activeTab, exclude: mode === "exclude" })] });
    } else if (kind === "resourceType") {
      onUpdate({ resourceFilters: [...profile.resourceFilters, createResourceFilter({ exclude: mode === "exclude" })] });
    } else if (kind === "method") {
      onUpdate({ methodFilters: [...profile.methodFilters, createMethodFilter({ exclude: mode === "exclude" })] });
    } else {
      onUpdate({ initiatorDomainFilters: [...profile.initiatorDomainFilters, createDomainFilter({ exclude: mode === "exclude" })] });
    }
    setOpen(true);
    setShowAddPanel(false);
  };

  const updateFilter = (filter: FilterView, patch: Partial<FilterView>) => {
    const next = { ...filter, ...patch };
    if (patch.kind && patch.kind !== filter.kind) return;

    if (filter.kind === "urlPattern" || filter.kind === "urlRegex") {
      const source = filter.mode === "include" ? profile.urlFilters : profile.excludeUrlFilters;
      const updated = source.map((item) => item.id === filter.id ? {
        ...item,
        enabled: next.enabled,
        urlRegex: String(next.value),
        matchType: next.kind === "urlRegex" ? "regex" as const : "pattern" as const,
      } : item);
      if (next.mode === filter.mode) {
        onUpdate(filter.mode === "include" ? { urlFilters: updated } : { excludeUrlFilters: updated });
      } else {
        const moved = updated.find((item) => item.id === filter.id)!;
        const collections = withoutFilter(filter.id);
        if (next.mode === "include") collections.urlFilters.push(moved);
        else collections.excludeUrlFilters.push(moved);
        onUpdate(collections);
      }
      return;
    }

    if (filter.kind === "tab") {
      onUpdate({ tabFilters: profile.tabFilters.map((item) => item.id === filter.id ? { ...item, enabled: next.enabled, tabId: next.value, exclude: next.mode === "exclude" } : item) });
    } else if (filter.kind === "resourceType") {
      onUpdate({ resourceFilters: profile.resourceFilters.map((item) => item.id === filter.id ? { ...item, enabled: next.enabled, resourceType: [String(next.value)], exclude: next.mode === "exclude" } : item) });
    } else if (filter.kind === "method") {
      onUpdate({ methodFilters: profile.methodFilters.map((item) => item.id === filter.id ? { ...item, enabled: next.enabled, method: String(next.value) as RequestMethod, exclude: next.mode === "exclude" } : item) });
    } else {
      onUpdate({ initiatorDomainFilters: profile.initiatorDomainFilters.map((item) => item.id === filter.id ? { ...item, enabled: next.enabled, domain: String(next.value), exclude: next.mode === "exclude" } : item) });
    }
  };

  const changeKind = (filter: FilterView, kind: FilterKind) => {
    if (kind === filter.kind) return;
    const collections = withoutFilter(filter.id);
    const common = { id: filter.id, enabled: filter.enabled, comment: filter.comment };
    if (kind === "urlPattern" || kind === "urlRegex") {
      const next = createUrlFilter({ ...common, matchType: kind === "urlRegex" ? "regex" : "pattern" });
      if (filter.mode === "exclude") collections.excludeUrlFilters.push(next);
      else collections.urlFilters.push(next);
    } else if (kind === "tab") {
      collections.tabFilters.push(createTabFilter({ ...common, tabId: tabs.find((tab) => tab.active)?.id ?? "", exclude: filter.mode === "exclude" }));
    } else if (kind === "resourceType") {
      collections.resourceFilters.push(createResourceFilter({ ...common, exclude: filter.mode === "exclude" }));
    } else if (kind === "method") {
      collections.methodFilters.push(createMethodFilter({ ...common, exclude: filter.mode === "exclude" }));
    } else {
      collections.initiatorDomainFilters.push(createDomainFilter({ ...common, exclude: filter.mode === "exclude" }));
    }
    onUpdate(collections);
  };

  const setAllEnabled = () => {
    const nextEnabled = !enabled;
    onUpdate({
      urlFilters: profile.urlFilters.map((filter) => ({ ...filter, enabled: nextEnabled })),
      excludeUrlFilters: profile.excludeUrlFilters.map((filter) => ({ ...filter, enabled: nextEnabled })),
      tabFilters: profile.tabFilters.map((filter) => ({ ...filter, enabled: nextEnabled })),
      resourceFilters: profile.resourceFilters.map((filter) => ({ ...filter, enabled: nextEnabled })),
      methodFilters: profile.methodFilters.map((filter) => ({ ...filter, enabled: nextEnabled })),
      initiatorDomainFilters: profile.initiatorDomainFilters.map((filter) => ({ ...filter, enabled: nextEnabled })),
    });
  };

  const clearAll = () => onUpdate({
    urlFilters: [],
    excludeUrlFilters: [],
    tabFilters: [],
    resourceFilters: [],
    methodFilters: [],
    initiatorDomainFilters: [],
  });

  return (
    <section>
      <div className="flex items-center gap-2 px-1 py-2">
        <button type="button" aria-label={enabled ? t("filter.disableAll") : t("filter.enableAll")} onClick={setAllEnabled} className={`flex h-4 w-4 items-center justify-center rounded border transition ${enabled ? "border-[var(--theme-color)] bg-[var(--theme-color)] text-white" : "border-slate-300 bg-white text-transparent"}`}>
          <Check aria-hidden="true" className="h-3 w-3" />
        </button>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => setOpen((current) => !current)}>
          {open ? <ChevronDown aria-hidden="true" className="h-4 w-4 text-slate-400" /> : <ChevronRight aria-hidden="true" className="h-4 w-4 text-slate-400" />}
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{t("section.filters")}</span>
          <span className="text-[11px] text-slate-400">· {filters.length}</span>
        </button>
        <button
          type="button"
          aria-label={t("filter.add")}
          aria-expanded={showAddPanel}
          onClick={() => {
            if (compact) {
              addFilter("urlPattern");
              return;
            }
            setOpen(true);
            setShowAddPanel((current) => {
              const next = !current;
              if (next) {
                setDraftKind("urlPattern");
                setDraftMode("include");
              }
              return next;
            });
          }}
          className={`rounded-lg p-1.5 transition hover:bg-white hover:text-[var(--theme-color)] ${showAddPanel ? "bg-white text-[var(--theme-color)]" : "text-slate-400"}`}
        >
          <Plus aria-hidden="true" className={`h-4 w-4 transition ${showAddPanel ? "rotate-45" : ""}`} />
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" aria-label={t("filter.more")} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700"><MoreVertical aria-hidden="true" className="h-4 w-4" /></button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="z-[100] min-w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
              <DropdownMenu.Item className={`${menuItemClass} text-rose-600`} disabled={filters.length === 0} onSelect={clearAll}>
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> {t("filter.clear")}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      {open && (
        <div className={compact ? "space-y-1.5" : "space-y-2"}>
          {showAddPanel && (
            <div className="rounded-2xl border border-[var(--theme-color)] bg-white p-4 shadow-sm" data-testid="filter-type-panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-800">{t("filter.addTitle")}</div>
                  <div className="mt-1 text-xs text-slate-500">{t("filter.addDescription")}</div>
                </div>
                <button type="button" aria-label={t("common.close")} onClick={() => setShowAddPanel(false)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>

              <div role="tablist" aria-label={t("filter.chooseType")} className="mt-4 flex flex-wrap gap-2">
                {(Object.keys(FILTER_LABEL_KEYS) as FilterKind[]).map((kind) => {
                  const selected = draftKind === kind;
                  return (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      key={kind}
                      onClick={() => setDraftKind(kind)}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)] ${
                        selected
                          ? "border-[var(--theme-color)] bg-slate-50 text-[var(--theme-color)] shadow-sm"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      {t(FILTER_LABEL_KEYS[kind])}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3">
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" aria-label={t("filter.modeLabel")}>
                  {(["include", "exclude"] as FilterMode[]).map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      aria-pressed={draftMode === mode}
                      onClick={() => setDraftMode(mode)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${draftMode === mode ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                    >
                      {t(mode === "include" ? "filter.include" : "filter.exclude")}
                    </button>
                  ))}
                </div>

                {draftKind === "tab" && (
                  <div className="min-w-0 flex-1 text-xs text-slate-500" data-testid="current-tab-default">
                    <span className="font-semibold text-slate-700">{t("filter.currentTabDefault")}</span>
                    <span className="ml-1">{activeTab?.title?.trim() || t("filter.noCurrentTab")}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => addFilter(draftKind, { mode: draftMode })}
                  className="ml-auto inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--theme-color)] px-4 text-xs font-bold text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)]"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  {t("filter.addSelected", { type: t(FILTER_LABEL_KEYS[draftKind]) })}
                </button>
              </div>
            </div>
          )}
          {visibleFilters.map((filter) => (
            <FilterRow
              key={filter.id}
              filter={filter}
              autoFocusValue={filter.id === focusFilterId || filter.id === localFocusFilterId}
              tabs={tabs}
              onPatch={(patch) => updateFilter(filter, patch)}
              onKindChange={(kind) => changeKind(filter, kind)}
              onDelete={() => onUpdate(withoutFilter(filter.id))}
              compact={compact}
            />
          ))}
          {!compact && filters.length === 0 && <EmptyState label={t("filter.noFilters")} />}
          {filters.length > 0 && visibleFilters.length === 0 && <EmptyState label={t("filter.noMatched")} />}
          {!compact && filters.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-100/70 px-4 py-3 text-xs text-slate-500">
              {t("filter.help")}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function RedirectSection({
  replacements,
  searchQuery,
  onChange,
}: {
  replacements: UrlReplacement[];
  searchQuery: string;
  onChange: (replacements: UrlReplacement[]) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const query = searchQuery.trim().toLowerCase();
  const visible = replacements.filter((item) => !query || `${item.name} ${item.value} ${item.comment}`.toLowerCase().includes(query));
  const enabled = replacements.length > 0 && replacements.some((item) => item.enabled);
  return (
    <section>
      <SectionHeader
        title={t("section.urlRedirects")}
        count={replacements.length}
        open={open}
        enabled={enabled}
        onToggle={() => setOpen((current) => !current)}
        onToggleEnabled={() => onChange(replacements.map((item) => ({ ...item, enabled: !enabled })))}
        onAdd={() => { onChange([...replacements, createUrlReplacement()]); setOpen(true); }}
        onClear={() => onChange([])}
      />
      {open && (
        <div className="space-y-2">
          {visible.map((item) => (
            <div key={item.id} className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm ${item.enabled ? "" : "opacity-60"}`}>
              <Switch checked={item.enabled} onCheckedChange={(enabled) => onChange(replacements.map((current) => current.id === item.id ? { ...current, enabled } : current))} aria-label={t("redirect.enable")} />
                <input aria-label={t("redirect.pattern")} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-[var(--theme-color)]" placeholder={t("redirect.patternPlaceholder")} value={item.name} onChange={(event) => onChange(replacements.map((current) => current.id === item.id ? { ...current, name: event.target.value } : current))} />
              <span className="text-slate-400">→</span>
              <input aria-label={t("redirect.target")} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-[var(--theme-color)]" placeholder={t("redirect.targetPlaceholder")} value={item.value} onChange={(event) => onChange(replacements.map((current) => current.id === item.id ? { ...current, value: event.target.value } : current))} />
              <button type="button" aria-label={t("redirect.delete")} onClick={() => onChange(replacements.filter((current) => current.id !== item.id))} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"><X aria-hidden="true" className="h-4 w-4" /></button>
            </div>
          ))}
          {replacements.length === 0 && <EmptyState label={t("redirect.none")} />}
        </div>
      )}
    </section>
  );
}

function Sidebar({
  mode,
  collapsed,
  profiles,
  selectedIndex,
  searchQuery,
  onCollapsedChange,
  onSearchChange,
  onSelect,
  onAdd,
  onImport,
  onSort,
}: {
  mode: "options" | "popup";
  collapsed: boolean;
  profiles: Profile[];
  selectedIndex: number;
  searchQuery: string;
  onCollapsedChange: (collapsed: boolean) => void;
  onSearchChange: (query: string) => void;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onImport: () => void;
  onSort: () => void;
}) {
  const { t } = useTranslation();
  return (
    <aside data-sidebar-collapsed={collapsed} className={`${collapsed ? "w-[60px]" : mode === "popup" ? "w-[212px]" : "w-60"} flex h-full shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white transition-[width] duration-200`}>
      <div className={`flex h-[52px] items-center gap-2 border-b border-slate-100 ${collapsed ? "justify-center px-2" : "px-3"}`}>
        <button type="button" aria-label={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")} onClick={() => onCollapsedChange(!collapsed)} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100">
          {collapsed ? <PanelLeftOpen aria-hidden="true" className="h-4 w-4" /> : <PanelLeftClose aria-hidden="true" className="h-4 w-4" />}
        </button>
        {!collapsed && <span className="text-sm font-bold tracking-tight text-slate-800">ModHeader V2</span>}
      </div>

      <div className={collapsed ? "p-2" : "p-3"}>
        {collapsed ? (
          <button type="button" aria-label={t("nav.searchRules")} onClick={() => onCollapsedChange(false)} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"><Search aria-hidden="true" className="h-4 w-4" /></button>
        ) : (
          <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-2.5 focus-within:border-[var(--theme-color)] focus-within:ring-2 focus-within:ring-[var(--theme-color)]">
            <Search aria-hidden="true" className="h-4 w-4 text-slate-400" />
            <input value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder={t("nav.searchRules")} className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400" />
            {searchQuery && <button type="button" aria-label={t("tab.clearSearch")} onClick={() => onSearchChange("")}><X aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" /></button>}
          </label>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {!collapsed && <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t("profile.list")}</div>}
        <div className="space-y-1">
          {profiles.map((profile, index) => {
            const selected = index === selectedIndex;
            return (
              <button
                type="button"
                key={profile.id}
                onClick={() => onSelect(index)}
                title={collapsed ? profile.title : undefined}
                className={`flex w-full items-center gap-2 rounded-lg p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)] ${selected ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold shadow-sm" style={{ backgroundColor: profile.backgroundColor, color: profile.textColor }}>
                  {profile.shortTitle}
                  <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${profile.enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
                </span>
                {!collapsed && <span className="min-w-0 flex-1 truncate text-xs font-semibold">{profile.title}</span>}
              </button>
            );
          })}
        </div>
        {collapsed && (
          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
            <button type="button" aria-label={t("nav.importFile")} title={t("nav.importFile")} onClick={onImport} className="flex h-10 w-full items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"><ArrowDownToLine aria-hidden="true" className="h-4 w-4" /></button>
            <button type="button" aria-label={t("nav.sortRules")} title={t("nav.sortRules")} onClick={onSort} className="flex h-10 w-full items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"><ArrowUpDown aria-hidden="true" className="h-4 w-4" /></button>
          </div>
        )}

        {!collapsed && (
          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
            <button type="button" onClick={onImport} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"><ArrowDownToLine aria-hidden="true" className="h-4 w-4" /> {t("nav.importFile")}</button>
            <button type="button" onClick={onSort} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"><ArrowUpDown aria-hidden="true" className="h-4 w-4" /> {t("nav.sortRules")}</button>
          </div>
        )}
      </div>

      <div className="space-y-1 border-t border-slate-100 p-2">
        <button type="button" title={t("nav.feedback")} className="flex w-full items-center gap-3 rounded-lg p-2 text-xs text-slate-500 transition hover:bg-slate-50">{collapsed ? <MessageSquare aria-hidden="true" className="mx-auto h-4 w-4" /> : <><MessageSquare aria-hidden="true" className="h-4 w-4" /> {t("nav.feedback")}</>}</button>
        <button type="button" title={t("nav.help")} className="flex w-full items-center gap-3 rounded-lg p-2 text-xs text-slate-500 transition hover:bg-slate-50">{collapsed ? <CircleHelp aria-hidden="true" className="mx-auto h-4 w-4" /> : <><CircleHelp aria-hidden="true" className="h-4 w-4" /> {t("nav.help")}</>}</button>
      </div>
    </aside>
  );
}

export default function App({ mode = "options" }: { mode?: "options" | "popup" } = {}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "en" ? "en" : "zh-CN";
  const [state, setState] = useState<AppState>({ profiles: [], selectedProfileIndex: 0, isPaused: false });
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(mode === "popup");
  const [searchQuery, setSearchQuery] = useState("");
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [history, setHistory] = useState<{ past: HistorySnapshot[]; future: HistorySnapshot[] }>({ past: [], future: [] });
  const [notice, setNotice] = useState("");
  const [focusHeaderId, setFocusHeaderId] = useState<string | null>(null);
  const [focusCookieId, setFocusCookieId] = useState<string | null>(null);
  const [focusFilterId, setFocusFilterId] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCollapsed(mode === "popup" ? true : window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    loadState().then((next) => {
      setState(next);
      setLoaded(true);
    });
    const unwatchProfiles = profilesStorage.watch((profiles) => setState((current) => ({ ...current, profiles: normalizeProfiles(profiles) })));
    const unwatchIndex = selectedIndexStorage.watch((selectedProfileIndex) => setState((current) => ({ ...current, selectedProfileIndex })));
    const unwatchPaused = isPausedStorage.watch((isPaused) => setState((current) => ({ ...current, isPaused })));
    return () => { unwatchProfiles(); unwatchIndex(); unwatchPaused(); };
  }, [mode]);

  const handleCollapsedChange = (nextCollapsed: boolean) => {
    setCollapsed(nextCollapsed);
    if (mode !== "popup") window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(nextCollapsed));
  };

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const nextTabs = await browser.tabs.query({});
      if (!alive) return;
      setTabs(nextTabs.sort((left, right) => Number(right.active) - Number(left.active) || left.windowId - right.windowId || left.index - right.index));
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

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const profile = state.profiles[state.selectedProfileIndex];
  const snapshot = (): HistorySnapshot => ({ profiles: state.profiles, selectedIndex: state.selectedProfileIndex });
  const remember = () => setHistory((current) => ({ past: [...current.past, snapshot()].slice(-50), future: [] }));

  const handleUpdateProfile = async (patch: Partial<Profile>) => {
    if (!profile) return;
    remember();
    const profiles = await updateProfile(state.profiles, state.selectedProfileIndex, patch);
    setState((current) => ({ ...current, profiles }));
  };

  const handleConvertHeader = async (rule: HeaderRule, target: "request" | "response") => {
    if (!profile) return;
    if (target === "response") {
      await handleUpdateProfile({
        headers: profile.headers.filter((item) => item.id !== rule.id),
        respHeaders: [...profile.respHeaders, rule],
      });
      return;
    }
    await handleUpdateProfile({
      headers: [...profile.headers, rule],
      respHeaders: profile.respHeaders.filter((item) => item.id !== rule.id),
    });
  };

  const handleSelect = async (index: number) => {
    await selectedIndexStorage.setValue(index);
    setState((current) => ({ ...current, selectedProfileIndex: index }));
  };

  const handleAdd = async () => {
    remember();
    const result = await addProfile(state.profiles, locale);
    setState((current) => ({ ...current, profiles: result.profiles, selectedProfileIndex: result.index }));
  };

  const handleClone = async () => {
    if (!profile) return;
    remember();
    const result = await cloneProfile(state.profiles, state.selectedProfileIndex, locale);
    setState((current) => ({ ...current, profiles: result.profiles, selectedProfileIndex: result.index }));
    setNotice(t("profile.cloned"));
  };

  const handleDelete = async () => {
    if (!profile || !window.confirm(t("profile.deleteConfirm", { title: profile.title }))) return;
    remember();
    const result = await deleteProfile(state.profiles, state.selectedProfileIndex);
    setState((current) => ({ ...current, profiles: result.profiles, selectedProfileIndex: result.index }));
  };

  const handlePause = async () => {
    const isPaused = !state.isPaused;
    await isPausedStorage.setValue(isPaused);
    setState((current) => ({ ...current, isPaused }));
  };

  const restoreSnapshot = async (target: HistorySnapshot) => {
    await saveProfiles(target.profiles, target.selectedIndex);
    setState((current) => ({ ...current, profiles: target.profiles, selectedProfileIndex: target.selectedIndex }));
  };

  const undo = async () => {
    const target = history.past.at(-1);
    if (!target) return;
    const current = snapshot();
    setHistory((value) => ({ past: value.past.slice(0, -1), future: [current, ...value.future].slice(0, 50) }));
    await restoreSnapshot(target);
  };

  const redo = async () => {
    const target = history.future[0];
    if (!target) return;
    const current = snapshot();
    setHistory((value) => ({ past: [...value.past, current].slice(-50), future: value.future.slice(1) }));
    await restoreSnapshot(target);
  };

  const exportProfile = () => {
    if (!profile) return;
    const blob = new Blob([JSON.stringify({ version: 2, profiles: [profile] }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${profile.title.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "profile"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(t("profile.exported"));
  };

  const copyProfile = async () => {
    if (!profile) return;
    await navigator.clipboard.writeText(JSON.stringify({ version: 2, profiles: [profile] }, null, 2));
    setNotice(t("profile.copied"));
  };

  const importProfiles = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Profile[] | { profiles?: Profile[] };
      const imported = normalizeProfiles(Array.isArray(parsed) ? parsed : parsed.profiles);
      if (imported.length === 0) throw new Error(t("import.empty"));
      remember();
      const profiles = [...state.profiles, ...imported];
      const selectedIndex = state.profiles.length;
      await saveProfiles(profiles, selectedIndex);
      setState((current) => ({ ...current, profiles, selectedProfileIndex: selectedIndex }));
      setNotice(t("import.success", { count: imported.length }));
    } catch (error) {
      window.alert(t("import.failed", { message: error instanceof Error ? error.message : t("import.invalid") }));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sortRules = async () => {
    if (!profile) return;
    await handleUpdateProfile({
      headers: [...profile.headers].sort((a, b) => a.name.localeCompare(b.name)),
      respHeaders: [...profile.respHeaders].sort((a, b) => a.name.localeCompare(b.name)),
      urlFilters: [...profile.urlFilters].sort((a, b) => a.urlRegex.localeCompare(b.urlRegex)),
      excludeUrlFilters: [...profile.excludeUrlFilters].sort((a, b) => a.urlRegex.localeCompare(b.urlRegex)),
    });
    setNotice(t("sort.success"));
  };

  if (!loaded) return <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">{t("common.loading")}</div>;
  if (!profile) return <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">{t("profile.none")}</div>;

  return (
    <div
      className={`flex overflow-hidden bg-slate-100 text-slate-800 ${mode === "popup" ? "h-[580px] w-[780px]" : "h-screen w-full"}`}
      style={{ "--theme-color": profile.backgroundColor } as React.CSSProperties}
    >
      <Sidebar
        mode={mode}
        collapsed={collapsed}
        profiles={state.profiles}
        selectedIndex={state.selectedProfileIndex}
        searchQuery={searchQuery}
        onCollapsedChange={handleCollapsedChange}
        onSearchChange={setSearchQuery}
        onSelect={handleSelect}
        onAdd={handleAdd}
        onImport={() => fileInputRef.current?.click()}
        onSort={sortRules}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 px-4 shadow-sm" style={{ backgroundColor: profile.backgroundColor, color: profile.textColor }}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/40 text-xs font-semibold">{state.selectedProfileIndex + 1}</span>
          <input
            ref={titleRef}
            value={profile.title}
            onChange={(event) => void handleUpdateProfile({ title: event.target.value })}
            aria-label={t("profile.name")}
            className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-current/60"
          />
          <div className="flex items-center gap-0.5">
            <button type="button" title={t("toolbar.undo")} aria-label={t("toolbar.undo")} disabled={history.past.length === 0} onClick={() => void undo()} className={iconButtonClass(history.past.length === 0)}><Undo2 aria-hidden="true" className="h-4 w-4" /></button>
            <button type="button" title={t("toolbar.redo")} aria-label={t("toolbar.redo")} disabled={history.future.length === 0} onClick={() => void redo()} className={iconButtonClass(history.future.length === 0)}><Redo2 aria-hidden="true" className="h-4 w-4" /></button>
            <button type="button" title={t("toolbar.newProfile")} aria-label={t("toolbar.newProfile")} onClick={() => void handleAdd()} className={iconButtonClass()}><Plus aria-hidden="true" className="h-4 w-4" /></button>
            <button type="button" title={state.isPaused ? t("toolbar.resume") : t("toolbar.pause")} aria-label={state.isPaused ? t("toolbar.resume") : t("toolbar.pause")} onClick={() => void handlePause()} className={iconButtonClass()}>{state.isPaused ? <Play aria-hidden="true" className="h-4 w-4" /> : <Pause aria-hidden="true" className="h-4 w-4" />}</button>
            <button type="button" title={t("profile.export")} aria-label={t("profile.export")} onClick={exportProfile} className={iconButtonClass()}><FileUp aria-hidden="true" className="h-4 w-4" /></button>
            <button type="button" title={t("toolbar.expand")} aria-label={t("toolbar.expand")} onClick={() => { void browser.runtime.openOptionsPage(); window.close(); }} className={iconButtonClass()}><Maximize2 aria-hidden="true" className="h-4 w-4" /></button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" title={t("common.language")} aria-label={t("common.language")} className={`${iconButtonClass()} flex items-center gap-1 text-xs font-semibold`}><Languages aria-hidden="true" className="h-4 w-4" /> {locale === "zh-CN" ? "EN" : "中"}</button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={8} className="z-[100] min-w-36 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl">
                  <DropdownMenu.Item className={menuItemClass} onSelect={() => void i18n.changeLanguage("zh-CN")}><span className="w-5 text-center">中</span> {t("common.chinese")}</DropdownMenu.Item>
                  <DropdownMenu.Item className={menuItemClass} onSelect={() => void i18n.changeLanguage("en")}><span className="w-5 text-center">EN</span> {t("common.english")}</DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" title={t("toolbar.profileMenu")} aria-label={t("toolbar.profileMenu")} className={iconButtonClass()}><MoreVertical aria-hidden="true" className="h-4 w-4" /></button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={8} className="z-[100] min-w-52 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl">
                  <DropdownMenu.Item className={menuItemClass} onSelect={() => window.setTimeout(() => titleRef.current?.select(), 0)}><MoreHorizontal aria-hidden="true" className="h-4 w-4" /> {t("profile.rename")}</DropdownMenu.Item>
                  <DropdownMenu.Item className={menuItemClass} onSelect={() => void handleClone()}><Copy aria-hidden="true" className="h-4 w-4" /> {t("profile.clone")}</DropdownMenu.Item>
                  <DropdownMenu.Item className={menuItemClass} onSelect={() => window.setTimeout(() => colorInputRef.current?.click(), 0)}><Palette aria-hidden="true" className="h-4 w-4" /> {t("profile.changeColor")}</DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
                  <DropdownMenu.Item className={menuItemClass} onSelect={exportProfile}><FileDown aria-hidden="true" className="h-4 w-4" /> {t("profile.exportFile")}</DropdownMenu.Item>
                  <DropdownMenu.Item className={menuItemClass} onSelect={() => void copyProfile()}><Copy aria-hidden="true" className="h-4 w-4" /> {t("profile.copy")}</DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
                  <DropdownMenu.Item className={`${menuItemClass} text-rose-600`} onSelect={() => void handleDelete()}><Trash2 aria-hidden="true" className="h-4 w-4" /> {t("profile.delete")}</DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>

        {state.isPaused && <div className="flex h-9 shrink-0 items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 text-xs font-medium text-amber-700"><Pause aria-hidden="true" className="h-3.5 w-3.5" /> {t("toolbar.paused")}</div>}

        <div className="flex-1 overflow-y-auto">
          <div className={`mx-auto w-full max-w-6xl ${mode === "popup" ? "px-4 py-4" : "px-4 py-5 sm:px-6"}`}>
            {mode !== "popup" && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <Switch checked={profile.enabled} onCheckedChange={(enabled) => void handleUpdateProfile({ enabled })} aria-label={profile.enabled ? t("common.enabled") : t("common.disabled")} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-700">{profile.enabled ? t("profile.enabled") : t("profile.disabled")}</div>
                <div className="mt-0.5 text-[11px] text-slate-400">{t("status.autoSave")}</div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="rounded-full bg-slate-100 px-2 py-1">{t("mod.count", { count: profile.headers.length + profile.respHeaders.length + profile.cookies.length + profile.urlReplacements.length })}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1">{t("filter.count", { count: profileFilters(profile).length })}</span>
              </div>
            </div>}

            <div className={mode === "popup" ? "space-y-2.5" : "space-y-4"}>
              <HeaderSection
                title={t("section.requestHeaders")}
                rules={profile.headers}
                searchQuery={searchQuery}
                focusRuleId={focusHeaderId}
                convertLabel={t("header.convertToResponse")}
                onConvertRule={(rule) => void handleConvertHeader(rule, "response")}
                onChange={(headers) => void handleUpdateProfile({ headers })}
                compact={mode === "popup"}
              />
              {profile.cookies.length > 0 && <CookieSection
                cookies={profile.cookies}
                searchQuery={searchQuery}
                focusCookieId={focusCookieId}
                onChange={(cookies) => void handleUpdateProfile({ cookies })}
                compact={mode === "popup"}
              />}
              {profile.respHeaders.length > 0 && <HeaderSection
                title={t("section.responseHeaders")}
                rules={profile.respHeaders}
                searchQuery={searchQuery}
                convertLabel={t("header.convertToRequest")}
                onConvertRule={(rule) => void handleConvertHeader(rule, "request")}
                onChange={(respHeaders) => void handleUpdateProfile({ respHeaders })}
                compact={mode === "popup"}
              />}
              {profile.urlReplacements.length > 0 && <RedirectSection replacements={profile.urlReplacements} searchQuery={searchQuery} onChange={(urlReplacements) => void handleUpdateProfile({ urlReplacements })} />}
              <FilterSection profile={profile} tabs={tabs} searchQuery={searchQuery} focusFilterId={focusFilterId} onUpdate={(patch) => void handleUpdateProfile(patch)} compact={mode === "popup"} />
            </div>

            <div className={mode === "popup" ? "mt-3 flex flex-wrap items-center gap-2" : "mt-5 flex flex-wrap items-center gap-2"}>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--theme-color)] px-4 text-xs font-bold text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)]"><Plus aria-hidden="true" className="h-4 w-4" /> {t("mod.quickAdd")}</button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="start" sideOffset={6} className="z-[100] min-w-[180px] rounded-xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl">
                    <DropdownMenu.Label className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("mod.title")}</DropdownMenu.Label>
                    <DropdownMenu.Item className={menuItemClass} onSelect={() => {
                      const nextRule = createHeaderRule();
                      setFocusHeaderId(nextRule.id);
                      void handleUpdateProfile({ headers: [...profile.headers, nextRule] });
                    }}>{t("section.requestHeaders")}</DropdownMenu.Item>
                    <DropdownMenu.Item className={menuItemClass} onSelect={() => {
                      const nextRule = createHeaderRule();
                      setFocusHeaderId(nextRule.id);
                      void handleUpdateProfile({ respHeaders: [...profile.respHeaders, nextRule] });
                    }}>{t("section.responseHeaders")}</DropdownMenu.Item>
                    <DropdownMenu.Item className={menuItemClass} onSelect={() => {
                      const cookie = createCookieRule();
                      setFocusCookieId(cookie.id);
                      void handleUpdateProfile({ cookies: [...profile.cookies, cookie] });
                    }}>{t("mod.cookies")}</DropdownMenu.Item>
                    <DropdownMenu.Item className={menuItemClass} onSelect={() => void handleUpdateProfile({ urlReplacements: [...profile.urlReplacements, createUrlReplacement()] })}>{t("section.urlRedirects")}</DropdownMenu.Item>
                    <DropdownMenu.Item className={menuItemClass} onSelect={() => {
                      const nextRule = createHeaderRule({ name: "Content-Security-Policy" });
                      setFocusHeaderId(nextRule.id);
                      void handleUpdateProfile({ respHeaders: [...profile.respHeaders, nextRule] });
                    }}>{t("mod.csp")}</DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              <button type="button" onClick={() => {
                const nextFilter = createUrlFilter({ matchType: "pattern" });
                setFocusFilterId(nextFilter.id);
                void handleUpdateProfile({ urlFilters: [...profile.urlFilters, nextFilter] });
              }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)]"><Filter aria-hidden="true" className="h-4 w-4" /> {t("filter.quickAdd")}</button>
            </div>
          </div>
        </div>
      </main>

      <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importProfiles(event.target.files?.[0])} />
      <input ref={colorInputRef} type="color" value={profile.backgroundColor} className="sr-only" onChange={(event) => void handleUpdateProfile({ backgroundColor: event.target.value, textColor: "white" })} />
      {notice && <div role="status" aria-live="polite" className="fixed bottom-5 right-5 z-[200] rounded-xl bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl">{notice}</div>}
    </div>
  );
}
