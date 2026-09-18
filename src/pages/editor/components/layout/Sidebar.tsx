import { clsx } from "clsx";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortableOperation, useSortable } from "@dnd-kit/react/sortable";
import {
  ArrowUpDown,
  CircleHelp,
  FileInput,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
  getProfileShortTitle,
  getProfileTextColor,
} from "../../../../types/profile/profile-appearance";
import type { Profile } from "../../../../types/profile/profile-model";
import { useEditorController } from "../../editor-controller";
import { useAppStore } from "../../../../store/app-store";
import type { EditorMode } from "../../types";

const SortableProfileItem = memo(function SortableProfileItem({
  collapsed,
  profile,
  index,
  selected,
  onSelect,
}: {
  collapsed: boolean;
  profile: Profile;
  index: number;
  selected: boolean;
  onSelect: (profileId: string) => void;
}) {
  const { ref, isDragging } = useSortable({ id: profile.id, index });
  const badgeLabel = getProfileShortTitle(profile.title);
  const foregroundColor = getProfileTextColor(profile.backgroundColor);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(profile.id)}
      title={collapsed ? profile.title : undefined}
      className={clsx(
        "flex w-full cursor-grab touch-none items-center gap-2 rounded-lg p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)] active:cursor-grabbing",
        selected ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50",
        profile.paused && "grayscale opacity-70",
        isDragging && "opacity-45",
      )}
    >
      <span
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold shadow-sm"
        style={{ backgroundColor: profile.backgroundColor, color: foregroundColor }}
      >
        {badgeLabel}
        <span
          className={clsx(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white",
            profile.enabled && !profile.paused ? "bg-emerald-500" : "bg-slate-300",
          )}
        />
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{profile.title}</span>
      )}
    </button>
  );
});

export function Sidebar({ mode, onImport }: { mode: EditorMode; onImport: () => void }) {
  const { t } = useTranslation();
  const { profiles, selectedProfileId, actions } = useEditorController();
  const { selectProfile, reorderProfiles, sortProfileRules } = actions;
  const collapsed = useAppStore((state) => state.collapsed);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const setCollapsed = useAppStore((state) => state.setCollapsed);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);
  const showNotice = useAppStore((state) => state.showNotice);

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.canceled || !isSortableOperation(event.operation)) return;
    const { source, target } = event.operation;
    if (!source || !target) return;
    if (source.sortable.index === target.sortable.index) return;
    void reorderProfiles(source.sortable.index, target.sortable.index);
  };

  const handleSort = () => {
    if (!selectedProfileId) return;
    void sortProfileRules(selectedProfileId).then((saved) => {
      if (saved) showNotice(t("sort.success"));
    });
  };

  return (
    <aside
      data-sidebar-collapsed={collapsed}
      className={clsx(
        collapsed ? "w-[60px]" : mode === "popup" ? "w-[212px]" : "w-60",
        "flex h-full shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white transition-[width] duration-200",
      )}
    >
      <div
        className={clsx(
          "flex h-14 items-center gap-2 border-b border-slate-100",
          collapsed ? "justify-center px-2" : "px-3",
        )}
      >
        <button
          type="button"
          aria-label={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
        {!collapsed && (
          <span className="text-sm font-bold tracking-tight text-slate-800">ModHeader V2</span>
        )}
      </div>

      <div className={clsx(collapsed ? "p-2" : "p-3")}>
        {collapsed ? (
          <button
            type="button"
            aria-label={t("nav.searchRules")}
            onClick={() => setCollapsed(false)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
          >
            <Search aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : (
          <label className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-2.5 focus-within:border-[var(--theme-color)] focus-within:ring-2 focus-within:ring-[var(--theme-color)]">
            <Search aria-hidden="true" className="h-4 w-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("nav.searchRules")}
              className="min-w-0 flex-1 bg-transparent text-xs font-normal text-slate-700 outline-none placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label={t("tab.clearSearch")}
                onClick={() => setSearchQuery("")}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
              </button>
            )}
          </label>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {!collapsed && (
          <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {t("profile.list")}
          </div>
        )}
        <DragDropProvider onDragEnd={handleDragEnd}>
          <div className="space-y-1">
            {profiles.map((profile, index) => (
              <SortableProfileItem
                key={profile.id}
                collapsed={collapsed}
                profile={profile}
                index={index}
                selected={profile.id === selectedProfileId}
                onSelect={selectProfile}
              />
            ))}
          </div>
        </DragDropProvider>
        {collapsed && (
          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
            <button
              type="button"
              aria-label={t("nav.importFile")}
              title={t("nav.importFile")}
              onClick={onImport}
              className="flex h-10 w-full items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
            >
              <FileInput aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={t("nav.sortRules")}
              title={t("nav.sortRules")}
              onClick={handleSort}
              className="flex h-10 w-full items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
            >
              <ArrowUpDown aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        )}

        {!collapsed && (
          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onImport}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            >
              <FileInput aria-hidden="true" className="h-4 w-4" /> {t("nav.importFile")}
            </button>
            <button
              type="button"
              onClick={handleSort}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            >
              <ArrowUpDown aria-hidden="true" className="h-4 w-4" /> {t("nav.sortRules")}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-1 border-t border-slate-100 p-2">
        <button
          type="button"
          title={t("nav.feedback")}
          className="flex w-full items-center gap-3 rounded-lg p-2 text-xs text-slate-500 transition hover:bg-slate-50"
        >
          {collapsed ? (
            <MessageSquare aria-hidden="true" className="mx-auto h-4 w-4" />
          ) : (
            <>
              <MessageSquare aria-hidden="true" className="h-4 w-4" /> {t("nav.feedback")}
            </>
          )}
        </button>
        <button
          type="button"
          title={t("nav.help")}
          className="flex w-full items-center gap-3 rounded-lg p-2 text-xs text-slate-500 transition hover:bg-slate-50"
        >
          {collapsed ? (
            <CircleHelp aria-hidden="true" className="mx-auto h-4 w-4" />
          ) : (
            <>
              <CircleHelp aria-hidden="true" className="h-4 w-4" /> {t("nav.help")}
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
