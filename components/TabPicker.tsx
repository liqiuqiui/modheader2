import { useMemo, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { clsx } from "clsx";
import { Check, ChevronDown, RefreshCw, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useThemePortalContainer } from "./ThemePortalProvider";
import type { BrowserTab } from "../types/browser";
import { TabIcon } from "./TabIcon";

function getHost(url?: string) {
  if (!url) return "";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function TabPicker({
  value,
  tabs,
  currentTabId,
  onChange,
  compact = false,
}: {
  value: number | null;
  tabs: BrowserTab[];
  currentTabId?: number;
  onChange: (tabId: number) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const portalContainer = useThemePortalContainer();
  const selected = value === null ? undefined : tabs.find((tab) => tab.id === value);
  const currentTab = tabs.find((tab) => tab.id === currentTabId);
  const isClosedTab = value !== null && !selected;
  const canUseCurrentTab = isClosedTab && currentTab?.id !== undefined;

  const filteredTabs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return tabs;
    return tabs.filter((tab) =>
      `${tab.title ?? ""} ${tab.url ?? ""}`.toLowerCase().includes(normalized),
    );
  }, [query, tabs]);

  const label =
    selected?.title?.trim() || (value !== null ? t("tab.closed", { id: value }) : t("tab.select"));
  const host = selected ? getHost(selected.url) : "";

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Popover.Trigger asChild>
            <button
              type="button"
              className={clsx(
                "flex h-8 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white text-left text-xs font-normal text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:border-[var(--theme-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)] data-[state=open]:border-[var(--theme-color)]",
                compact ? "px-2" : "pr-2 pl-2.5",
              )}
              aria-haspopup="listbox"
            >
              <TabIcon tab={selected} className={clsx(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {host && !compact && (
                <span className="max-w-36 truncate text-xs text-slate-400">{host}</span>
              )}
              <ChevronDown
                aria-hidden="true"
                className={clsx("h-4 w-4 shrink-0 text-slate-400 transition", open && "rotate-180")}
              />
            </button>
          </Popover.Trigger>
        </div>
        {canUseCurrentTab && (
          <button
            type="button"
            onClick={() => onChange(currentTab.id!)}
            className={clsx(
              "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--theme-color)_30%,white)] bg-[color-mix(in_srgb,var(--theme-color)_8%,white)] font-medium text-[var(--theme-color)] transition hover:bg-[color-mix(in_srgb,var(--theme-color)_14%,white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)]",
              compact ? "h-8 px-2 text-xs" : "h-9 px-3 text-sm",
            )}
          >
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            {t("tab.useCurrent")}
          </button>
        )}
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
                className="min-w-0 flex-1 bg-transparent text-xs font-normal text-slate-800 outline-none placeholder:text-slate-400"
              />
              {query && (
                <button
                  type="button"
                  aria-label={t("tab.clearSearch")}
                  onClick={() => setQuery("")}
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
          </div>
          <div className="max-h-64 overflow-y-auto p-1" role="listbox">
            {filteredTabs.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-400">
                {t("tab.noResults")}
              </div>
            ) : (
              filteredTabs.map((tab) => {
                const isSelected = tab.id === value;
                const isCurrent = tab.id === currentTabId;
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
                    className={clsx(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)]",
                      !isSelected && "text-slate-700 hover:bg-slate-50",
                    )}
                    style={
                      isSelected
                        ? {
                            backgroundColor: "color-mix(in srgb, var(--theme-color) 10%, white)",
                            color: "var(--theme-color)",
                          }
                        : undefined
                    }
                  >
                    <TabIcon tab={tab} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-normal">
                        {tab.title || t("tab.untitled")}
                      </span>
                      <span className="block truncate text-[11px] text-slate-400">
                        {getHost(tab.url) || tab.url}
                      </span>
                    </span>
                    {isCurrent && (
                      <span className="rounded-full border border-[color-mix(in_srgb,var(--theme-color)_30%,white)] bg-[color-mix(in_srgb,var(--theme-color)_10%,white)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--theme-color)]">
                        {t("common.current")}
                      </span>
                    )}
                    {!isCurrent && tab.active && (
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                        {t("tab.active")}
                      </span>
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
