import { clsx } from "clsx";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  FILTER_KINDS,
  FILTER_MODES,
  type FilterKind,
  type FilterMode,
} from "../../../../types/profile/profile-model";
import type { BrowserTab } from "../../../../types/browser";
import { FILTER_LABEL_KEYS } from "../../constants";

export function FilterAddPanel({
  draftKind,
  draftMode,
  activeTab,
  onKindChange,
  onModeChange,
  onAdd,
  onClose,
}: {
  draftKind: FilterKind;
  draftMode: FilterMode;
  activeTab?: BrowserTab;
  onKindChange: (kind: FilterKind) => void;
  onModeChange: (mode: FilterMode) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-2xl border border-[var(--theme-color)] bg-white p-4 shadow-sm"
      data-testid="filter-type-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-800">{t("filter.addTitle")}</div>
          <div className="mt-1 text-xs text-slate-500">{t("filter.addDescription")}</div>
        </div>
        <button
          type="button"
          aria-label={t("common.close")}
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <div role="tablist" aria-label={t("filter.chooseType")} className="mt-4 flex flex-wrap gap-2">
        {FILTER_KINDS.map((kind) => {
          const selected = draftKind === kind;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              key={kind}
              onClick={() => onKindChange(kind)}
              className={clsx(
                "rounded-xl border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)]",
                selected
                  ? "border-[var(--theme-color)] bg-slate-50 text-[var(--theme-color)] shadow-sm"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white",
              )}
            >
              {t(FILTER_LABEL_KEYS[kind])}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3">
        <div
          className="inline-flex rounded-lg border border-slate-200 bg-white p-1"
          aria-label={t("filter.modeLabel")}
        >
          {FILTER_MODES.map((mode) => (
            <button
              type="button"
              key={mode}
              aria-pressed={draftMode === mode}
              onClick={() => onModeChange(mode)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                draftMode === mode
                  ? "bg-slate-800 text-white"
                  : "text-slate-500 hover:bg-slate-100",
              )}
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
          onClick={onAdd}
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--theme-color)] px-4 text-xs font-bold text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)]"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t("filter.addSelected", { type: t(FILTER_LABEL_KEYS[draftKind]) })}
        </button>
      </div>
    </div>
  );
}
