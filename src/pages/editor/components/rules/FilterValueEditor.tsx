import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { TabPicker } from "../../../../components/TabPicker";
import type { ProfileFilter } from "../../../../types/profile/profile-model";
import type { BrowserTab } from "../../../../types/browser";
import { FILTER_LABEL_KEYS, METHODS, RESOURCE_TYPES } from "../../constants";
import { FilterSelect } from "./FilterSelect";
import { filterSelectTextClass } from "../shared/styles";

export function FilterValueEditor({
  filter,
  tabs,
  currentTabId,
  onChange,
  autoFocus,
}: {
  filter: ProfileFilter;
  tabs: BrowserTab[];
  currentTabId?: number;
  onChange: (value: ProfileFilter["value"]) => void;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  if (filter.kind === "tab") {
    return (
      <TabPicker value={filter.value} tabs={tabs} currentTabId={currentTabId} onChange={onChange} />
    );
  }
  if (filter.kind === "tabGroup" || filter.kind === "window") {
    const values = Array.from(
      new Set(
        tabs
          .map((tab) => (filter.kind === "tabGroup" ? tab.groupId : tab.windowId))
          .filter((value): value is number => typeof value === "number" && value >= 0),
      ),
    );
    return (
      <FilterSelect
        ariaLabel={t(FILTER_LABEL_KEYS[filter.kind])}
        value={filter.value === null ? "" : String(filter.value)}
        onValueChange={(value) => onChange(value ? Number(value) : null)}
        className="min-w-0 flex-1"
        itemClassName={filterSelectTextClass}
        options={values.map((value) => ({ value: String(value), label: `#${value}` }))}
      />
    );
  }
  if (filter.kind === "resourceType") {
    return (
      <FilterSelect
        ariaLabel={t("filter.resourceTypeLabel")}
        value={filter.value}
        autoFocus={autoFocus}
        onValueChange={onChange}
        className="min-w-0 flex-1"
        itemClassName={filterSelectTextClass}
        options={RESOURCE_TYPES.map(([value, labelKey]) => ({ value, label: t(labelKey) }))}
      />
    );
  }
  if (filter.kind === "method") {
    return (
      <FilterSelect
        ariaLabel={t("filter.methodLabel")}
        value={filter.value}
        onValueChange={onChange}
        className="min-w-0 flex-1 uppercase"
        itemClassName={filterSelectTextClass}
        options={METHODS.map((method) => ({ value: method, label: method.toUpperCase() }))}
      />
    );
  }
  if (filter.kind === "time") {
    const localValue = new Date(filter.value)
      .toLocaleString("sv-SE")
      .replace(" ", "T")
      .slice(0, 16);
    return (
      <input
        aria-label={t("filter.time")}
        type="datetime-local"
        value={localValue}
        min={new Date().toLocaleString("sv-SE").replace(" ", "T").slice(0, 16)}
        onChange={(event) => {
          const timestamp = new Date(event.target.value).getTime();
          if (Number.isFinite(timestamp)) onChange(timestamp);
        }}
        className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-[var(--theme-color)]"
      />
    );
  }

  const placeholder =
    filter.kind === "initiator"
      ? t("filter.initiatorPlaceholder")
      : filter.kind === "requestDomain"
        ? t("filter.requestDomainPlaceholder")
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
        className={clsx(
          "h-8 w-full rounded-lg border bg-slate-50 px-3 font-mono text-xs font-normal text-slate-700 outline-none transition hover:bg-white focus:ring-2",
          invalid
            ? "border-rose-300 focus:ring-rose-500/20"
            : "border-slate-200 focus:ring-[var(--theme-color)]",
        )}
      />
      {invalid && (
        <div role="alert" className="mt-1 text-[11px] text-rose-600">
          {t("filter.invalidRegex")}
        </div>
      )}
    </div>
  );
}
