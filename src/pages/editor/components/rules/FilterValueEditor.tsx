import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { TabPicker } from "../../../../components/TabPicker";
import type { ProfileFilter } from "../../../../types/profile/profile-model";
import type { BrowserTab, BrowserTabGroup } from "../../../../types/browser";
import { FILTER_LABEL_KEYS, METHODS, RESOURCE_TYPES } from "../../constants";
import { FilterSelect, type FilterSelectOption } from "./FilterSelect";
import { filterSelectTextClass } from "../shared/styles";

// Colours mirror the swatches Chrome paints on tab groups, so a group without a
// title is still recognisable next to the browser UI.
const TAB_GROUP_COLORS: Record<string, string> = {
  blue: "#1a73e8",
  cyan: "#007b83",
  green: "#1e8e3e",
  grey: "#5f6368",
  orange: "#fa903e",
  pink: "#ff8bcb",
  purple: "#a142f4",
  red: "#d93025",
  yellow: "#f9ab00",
};

function groupTabsByWindow(tabs: BrowserTab[]): Map<number, BrowserTab[]> {
  const byWindow = new Map<number, BrowserTab[]>();
  for (const tab of tabs) {
    const windowId = tab.windowId;
    if (typeof windowId !== "number") continue;
    const list = byWindow.get(windowId);
    if (list) list.push(tab);
    else byWindow.set(windowId, [tab]);
  }
  for (const list of byWindow.values()) {
    list.sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
  }
  return byWindow;
}

export function FilterValueEditor({
  filter,
  tabs,
  tabGroups,
  tabGroupsAvailable,
  currentTabId,
  onChange,
  autoFocus,
}: {
  filter: ProfileFilter;
  tabs: BrowserTab[];
  tabGroups: BrowserTabGroup[];
  tabGroupsAvailable: boolean;
  currentTabId?: number;
  onChange: (value: ProfileFilter["value"]) => void;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  // Same resolution as the filter section: the popup's tab, otherwise the
  // active tab of the window the popup was opened in.
  const currentTab = tabs.find((tab) => tab.id === currentTabId) ?? tabs.find((tab) => tab.active);
  if (filter.kind === "tab") {
    return (
      <TabPicker value={filter.value} tabs={tabs} currentTabId={currentTabId} onChange={onChange} />
    );
  }
  if (filter.kind === "tabGroup") {
    const tabsByGroup = new Map<number, BrowserTab[]>();
    for (const tab of tabs) {
      const groupId = tab.groupId;
      if (typeof groupId !== "number" || groupId < 0) continue;
      const list = tabsByGroup.get(groupId);
      if (list) list.push(tab);
      else tabsByGroup.set(groupId, [tab]);
    }
    const currentGroupId =
      typeof currentTab?.groupId === "number" && currentTab.groupId >= 0
        ? currentTab.groupId
        : null;
    const groupIds = Array.from(tabsByGroup.keys()).sort(
      (left, right) =>
        Number(right === currentGroupId) - Number(left === currentGroupId) || left - right,
    );
    const groupsById = new Map(tabGroups.map((entry) => [entry.id, entry]));
    const options: FilterSelectOption<string>[] = groupIds.map((id) => {
      const group = groupsById.get(id);
      const groupTabs = tabsByGroup.get(id) ?? [];
      // Like the window filter: name the group, but also show which tab it
      // currently holds so an unnamed group is still recognisable.
      const headline =
        groupTabs.find((tab) => tab.id === currentTabId) ??
        groupTabs.find((tab) => tab.active) ??
        groupTabs[0];
      return {
        value: String(id),
        // Group IDs mean nothing to users, so fall back to the tab count that
        // at least makes two unnamed groups distinguishable.
        label: group?.title?.trim() || t("filter.tabGroupUntitled", { count: groupTabs.length }),
        sublabel: headline?.title?.trim() || undefined,
        badge: id === currentGroupId ? t("common.current") : undefined,
        swatch: group ? TAB_GROUP_COLORS[group.color] : undefined,
      };
    });
    if (filter.value === null) {
      options.unshift({ value: "", label: t("filter.notSet") });
    } else if (!tabsByGroup.has(filter.value)) {
      options.unshift({ value: String(filter.value), label: t("filter.tabGroupClosed") });
    }
    return (
      <div className="min-w-0 flex-1">
        <FilterSelect
          ariaLabel={t(FILTER_LABEL_KEYS[filter.kind])}
          value={filter.value === null ? "" : String(filter.value)}
          placeholder={t("filter.notSet")}
          onValueChange={(value) => onChange(value ? Number(value) : null)}
          className="w-full"
          itemClassName={filterSelectTextClass}
          options={options}
        />
        {!tabGroupsAvailable && (
          // The API only exists once the `tabGroups` permission is active, and
          // in dev the popup reloads itself over HMR while the browser keeps the
          // manifest it was loaded with — so say exactly what to do.
          <div role="alert" className="mt-1 text-[11px] text-amber-600">
            {t("filter.tabGroupPermissionMissing")}
          </div>
        )}
      </div>
    );
  }
  if (filter.kind === "window") {
    const tabsByWindow = groupTabsByWindow(tabs);
    const currentWindowId = currentTab?.windowId;
    const windowIds = Array.from(tabsByWindow.keys()).sort(
      (left, right) =>
        Number(right === currentWindowId) - Number(left === currentWindowId) || left - right,
    );
    const options: FilterSelectOption<string>[] = windowIds.map((id) => {
      const windowTabs = tabsByWindow.get(id) ?? [];
      // The ID stays the primary label, but a bare number says nothing about
      // which window it is — so pair it with the tab that window currently
      // shows, and mark the window the popup is running in like the tab picker.
      const activeTab = windowTabs.find((tab) => tab.active) ?? windowTabs[0];
      return {
        value: String(id),
        label: `#${id}`,
        sublabel:
          activeTab?.title?.trim() || t("filter.windowUntitled", { count: windowTabs.length }),
        badge: id === currentWindowId ? t("common.current") : undefined,
      };
    });
    if (filter.value === null) {
      options.unshift({ value: "", label: t("filter.notSet") });
    } else if (!tabsByWindow.has(filter.value)) {
      options.unshift({
        value: String(filter.value),
        label: `#${filter.value}`,
        sublabel: t("filter.windowClosed"),
      });
    }
    return (
      <FilterSelect
        ariaLabel={t(FILTER_LABEL_KEYS[filter.kind])}
        value={filter.value === null ? "" : String(filter.value)}
        placeholder={t("filter.notSet")}
        onValueChange={(value) => onChange(value ? Number(value) : null)}
        className="min-w-0 flex-1"
        itemClassName={filterSelectTextClass}
        options={options}
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
