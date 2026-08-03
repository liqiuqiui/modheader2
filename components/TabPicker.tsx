import React, { useEffect, useMemo, useRef, useState } from "react";
import { Popover } from "radix-ui";
import type { Browser } from "wxt/browser";
import { Check, ChevronDown, Globe2, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useThemePortalContainer } from "./ThemePortalProvider";

export type BrowserTab = Browser.tabs.Tab;

function getHost(url?: string) {
  if (!url) return "";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function TabIcon({ tab, className = "h-4 w-4" }: { tab?: BrowserTab; className?: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [tab?.favIconUrl]);

  if (tab?.favIconUrl && !failed) {
    return (
      <img
        src={tab.favIconUrl}
        alt=""
        loading="lazy"
        className={`${className} rounded-sm object-contain`}
        onError={() => setFailed(true)}
      />
    );
  }
  return <Globe2 aria-hidden="true" className={`${className} text-slate-400`} />;
}

export function TabPicker({
  value,
  tabs,
  onChange,
  compact = false,
}: {
  value: number | string;
  tabs: BrowserTab[];
  onChange: (tabId: number | string) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const portalContainer = useThemePortalContainer();
  const numericValue = Number(value);
  const selected = tabs.find((tab) => tab.id === numericValue);

  const filteredTabs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return tabs;
    return tabs.filter((tab) =>
      `${tab.title ?? ""} ${tab.url ?? ""}`.toLowerCase().includes(normalized),
    );
  }, [query, tabs]);

  const label = selected?.title?.trim() || (value !== "" ? t("tab.closed", { id: value }) : t("tab.select"));
  const host = selected ? getHost(selected.url) : "";

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white text-left text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:border-[var(--theme-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)] data-[state=open]:border-[var(--theme-color)] ${
              compact ? "h-8 px-2 text-xs" : "h-9 px-3 text-sm"
            }`}
            aria-haspopup="listbox"
          >
            <TabIcon tab={selected} className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
            {host && !compact && <span className="max-w-36 truncate text-xs text-slate-400">{host}</span>}
            <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
          </button>
        </Popover.Trigger>
      </div>

      <Popover.Portal container={portalContainer ?? undefined}>
        <Popover.Content
          align="start"
          side="bottom"
          sideOffset={8}
          collisionPadding={8}
          avoidCollisions
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            window.requestAnimationFrame(() => searchInputRef.current?.focus());
          }}
          className="z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl outline-none"
          style={{
            width: "var(--radix-popover-trigger-width)",
            maxHeight: "var(--radix-popover-content-available-height)",
          }}
        >
          <div className="border-b border-slate-100 p-2">
            <label className="flex h-8 items-center gap-2 rounded-lg bg-slate-100 px-2 text-slate-500 focus-within:ring-2 focus-within:ring-[var(--theme-color)]">
              <Search aria-hidden="true" className="h-3.5 w-3.5" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("tab.search")}
                className="min-w-0 flex-1 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"
              />
              {query && (
                <button type="button" aria-label={t("tab.clearSearch")} onClick={() => setQuery("")}>
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
          </div>
          <div className="max-h-64 overflow-y-auto p-1" role="listbox">
            {filteredTabs.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-400">{t("tab.noResults")}</div>
            ) : (
              filteredTabs.map((tab) => {
                const isSelected = tab.id === numericValue;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    key={tab.id}
                    onClick={() => {
                      if (tab.id !== undefined) onChange(tab.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)] ${
                      isSelected ? "" : "text-slate-700 hover:bg-slate-50"
                    }`}
                    style={isSelected ? {
                      backgroundColor: "color-mix(in srgb, var(--theme-color) 10%, white)",
                      color: "var(--theme-color)",
                    } : undefined}
                  >
                    <TabIcon tab={tab} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{tab.title || t("tab.untitled")}</span>
                      <span className="block truncate text-[11px] text-slate-400">{getHost(tab.url) || tab.url}</span>
                    </span>
                    {tab.active && (
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">{t("common.current")}</span>
                    )}
                    {isSelected && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
