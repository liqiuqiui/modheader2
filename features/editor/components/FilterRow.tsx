import { clsx } from "clsx";
import { GripVertical, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Switch } from "../../../components/ui/switch";
import type { BrowserTab } from "../../../types/browser";
import { FILTER_LABEL_KEYS } from "../constants";
import type { FilterKind, FilterMode, FilterView } from "../types";
import { FilterSelect } from "./FilterSelect";
import { FilterValueEditor } from "./FilterValueEditor";

export function FilterRow({
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
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.resolvedLanguage === "en";
  return (
    <div
      className={clsx(
        "group rounded-lg border bg-white transition",
        compact ? "p-1.5 shadow-sm" : "p-2.5 shadow-sm",
        filter.enabled ? "border-slate-200" : "border-slate-200/70 opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical
          aria-hidden="true"
          className="mt-2 hidden h-4 w-4 shrink-0 cursor-grab text-slate-300 sm:block"
        />
        <Switch
          checked={filter.enabled}
          onCheckedChange={(enabled) => onPatch({ enabled })}
          aria-label={t("filter.enable")}
          className="mt-2 shrink-0"
        />
        <FilterSelect
          ariaLabel={t("filter.modeLabel")}
          value={filter.mode}
          onValueChange={(value) => onPatch({ mode: value as FilterMode })}
          className={clsx("shrink-0 font-medium", isEnglish ? "w-24" : "w-[84px]")}
          options={[
            { value: "include", label: t("filter.include") },
            { value: "exclude", label: t("filter.exclude") },
          ]}
        />
        <FilterSelect
          ariaLabel={t("filter.typeLabel")}
          value={filter.kind}
          onValueChange={(value) => onKindChange(value as FilterKind)}
          className={clsx("shrink-0", isEnglish ? "w-36" : "w-[122px]")}
          options={(Object.keys(FILTER_LABEL_KEYS) as FilterKind[]).map((kind) => ({
            value: kind,
            label: t(FILTER_LABEL_KEYS[kind]),
          }))}
        />
        <FilterValueEditor
          filter={filter}
          tabs={tabs}
          autoFocus={autoFocusValue}
          onChange={(value) => onPatch({ value })}
        />
        <button
          type="button"
          aria-label={t("filter.delete")}
          onClick={onDelete}
          className="mt-0.5 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
