import { useCallback, useMemo, useState } from "react";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortableOperation } from "@dnd-kit/react/sortable";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { createFilter } from "../../../../services/rules/filter/filter-parser";
import type {
  FilterKind,
  FilterMode,
  Profile,
  ProfileFilterPatch,
} from "../../../../types/profile/profile-model";
import { useEditorController } from "../../editor-controller";
import type { BrowserTab } from "../../../../types/browser";
import { FILTER_LABEL_KEYS } from "../../constants";
import { EmptyState } from "../shared/EmptyState";
import { FilterAddPanel } from "../rules/FilterAddPanel";
import { FilterRow } from "../rules/FilterRow";
import { SectionContent } from "./SectionContent";
import { SectionHeader } from "./SectionHeader";

export function FilterSection({
  profile,
  tabs,
  currentTabId,
  searchQuery,
  focusFilterId,
  compact = false,
}: {
  profile: Profile;
  tabs: BrowserTab[];
  currentTabId?: number;
  searchQuery: string;
  focusFilterId?: string | null;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { actions } = useEditorController();
  const {
    addFilter,
    patchFilter,
    changeFilterKind,
    deleteFilter,
    reorderFilters,
    setFiltersEnabled,
    clearFilters,
  } = actions;
  const [open, setOpen] = useState(true);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [draftKind, setDraftKind] = useState<FilterKind>("tab");
  const [draftMode, setDraftMode] = useState<FilterMode>("include");
  const [localFocusFilterId, setLocalFocusFilterId] = useState<string | null>(null);
  const filters = profile.filters;
  const visibleFilters = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return filters;
    return filters.filter((filter) =>
      `${t(FILTER_LABEL_KEYS[filter.kind])} ${filter.mode} ${filter.value} ${filter.comment}`
        .toLowerCase()
        .includes(query),
    );
  }, [filters, searchQuery, t]);
  const enabled = filters.some((filter) => filter.enabled);
  const currentTab = tabs.find((tab) => tab.id === currentTabId) ?? tabs.find((tab) => tab.active);
  const filterIndices = useMemo(
    () => new Map(filters.map((filter, index) => [filter.id, index])),
    [filters],
  );
  const sortableDisabled = searchQuery.trim().length > 0;

  const handlePatch = useCallback(
    (filterId: string, kind: FilterKind, patch: ProfileFilterPatch) =>
      void patchFilter(profile.id, filterId, kind, patch),
    [patchFilter, profile.id],
  );
  const handleKindChange = useCallback(
    (filterId: string, kind: FilterKind) =>
      void changeFilterKind(profile.id, filterId, kind, currentTab?.id),
    [changeFilterKind, currentTab?.id, profile.id],
  );
  const handleDelete = useCallback(
    (filterId: string) => void deleteFilter(profile.id, filterId),
    [deleteFilter, profile.id],
  );

  const handleAdd = (kind: FilterKind, mode: FilterMode = "include") => {
    const filter = createFilter({ kind, mode, currentTabId: currentTab?.id });
    if (kind === "urlPattern" || kind === "urlRegex") {
      setLocalFocusFilterId(filter.id);
    }
    void addFilter(profile.id, filter);
    setOpen(true);
    setShowAddPanel(false);
  };

  const handleAddButton = () => {
    if (compact) {
      handleAdd("tab");
      return;
    }
    setOpen(true);
    setShowAddPanel((current) => {
      const next = !current;
      if (next) {
        setDraftKind("tab");
        setDraftMode("include");
      }
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.canceled || !isSortableOperation(event.operation)) return;
    const { source, target } = event.operation;
    if (!source || !target || source.sortable.index === target.sortable.index) return;
    const sourceFilterId = filters[source.sortable.index]?.id;
    const targetFilterId = filters[target.sortable.index]?.id;
    if (!sourceFilterId || !targetFilterId) return;
    void reorderFilters(profile.id, sourceFilterId, targetFilterId);
  };

  return (
    <section>
      <SectionHeader
        title={t("section.filters")}
        count={filters.length}
        open={open}
        enabled={enabled}
        onToggle={() => setOpen((current) => !current)}
        onToggleEnabled={() => void setFiltersEnabled(profile.id, !enabled)}
        onAdd={handleAddButton}
        onClear={() => void clearFilters(profile.id)}
        enableAllLabel={t("filter.enableAll")}
        disableAllLabel={t("filter.disableAll")}
        addLabel={t("filter.add")}
        moreLabel={t("filter.more")}
        clearLabel={t("filter.clear")}
        addExpanded={showAddPanel}
        addActive={showAddPanel}
        rotateAddIcon
      />
      <SectionContent open={open} className={clsx(compact ? "space-y-1.5" : "space-y-2")}>
        {showAddPanel && (
          <FilterAddPanel
            draftKind={draftKind}
            draftMode={draftMode}
            activeTab={currentTab}
            onKindChange={setDraftKind}
            onModeChange={setDraftMode}
            onAdd={() => handleAdd(draftKind, draftMode)}
            onClose={() => setShowAddPanel(false)}
          />
        )}
        <DragDropProvider onDragEnd={handleDragEnd}>
          {visibleFilters.map((filter) => (
            <FilterRow
              key={filter.id}
              filter={filter}
              autoFocusValue={filter.id === focusFilterId || filter.id === localFocusFilterId}
              tabs={tabs}
              currentTabId={currentTabId}
              onPatch={handlePatch}
              onKindChange={handleKindChange}
              onDelete={handleDelete}
              sortableIndex={filterIndices.get(filter.id) ?? 0}
              sortableDisabled={sortableDisabled}
              compact={compact}
            />
          ))}
        </DragDropProvider>
        {!compact && filters.length === 0 && <EmptyState label={t("filter.noFilters")} />}
        {filters.length > 0 && visibleFilters.length === 0 && (
          <EmptyState label={t("filter.noMatched")} />
        )}
        {!compact && filters.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-100/70 px-4 py-3 text-xs text-slate-500">
            {t("filter.help")}
          </div>
        )}
      </SectionContent>
    </section>
  );
}
