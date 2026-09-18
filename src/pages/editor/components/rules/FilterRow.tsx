import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { clsx } from "clsx";
import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical, MessageSquarePlus, MessageSquareX, MoreHorizontal, X } from "lucide-react";
import { memo, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../../../../components/ui/input";
import { Switch } from "../../../../components/ui/switch";
import {
  FILTER_KINDS,
  FILTER_MODES,
  type FilterKind,
  type ProfileFilter,
  type ProfileFilterPatch,
} from "../../../../types/profile/profile-model";
import type { BrowserTab } from "../../../../types/browser";
import { FILTER_LABEL_KEYS } from "../../constants";
import { FilterSelect } from "./FilterSelect";
import { FilterValueEditor } from "./FilterValueEditor";
import { filterSelectTextClass, menuItemClass } from "../shared/styles";

function FilterRowComponent({
  filter,
  tabs,
  currentTabId,
  onPatch,
  onKindChange,
  onDelete,
  autoFocusValue,
  sortableIndex,
  sortableDisabled = false,
  compact = false,
}: {
  filter: ProfileFilter;
  tabs: BrowserTab[];
  currentTabId?: number;
  onPatch: (filterId: string, kind: FilterKind, patch: ProfileFilterPatch) => void;
  onKindChange: (filterId: string, kind: FilterKind) => void;
  onDelete: (filterId: string) => void;
  autoFocusValue?: boolean;
  sortableIndex: number;
  sortableDisabled?: boolean;
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.resolvedLanguage === "en";
  const [showComment, setShowComment] = useState(Boolean(filter.comment));
  const commentRef = useRef<HTMLInputElement>(null);
  const commentVisible = showComment || Boolean(filter.comment);
  const modeOptions = useMemo(
    () =>
      FILTER_MODES.map((mode) => ({
        value: mode,
        label: t(mode === "include" ? "filter.include" : "filter.exclude"),
      })),
    [i18n.resolvedLanguage, t],
  );
  const kindOptions = useMemo(
    () => FILTER_KINDS.map((kind) => ({ value: kind, label: t(FILTER_LABEL_KEYS[kind]) })),
    [i18n.resolvedLanguage, t],
  );
  const { ref, handleRef, isDragging } = useSortable({
    id: filter.id,
    index: sortableIndex,
    disabled: sortableDisabled,
  });
  return (
    <div
      ref={ref}
      className={clsx(
        "group rounded-lg border bg-white transition",
        compact ? "p-1.5 shadow-sm" : "p-2.5 shadow-sm",
        filter.enabled ? "border-slate-200" : "border-slate-200/70 opacity-60",
        isDragging && "opacity-45",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          ref={handleRef}
          type="button"
          aria-label={t("filter.reorder")}
          disabled={sortableDisabled}
          className="mt-1.5 hidden shrink-0 cursor-grab rounded p-0.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)] active:cursor-grabbing disabled:cursor-default disabled:opacity-40 sm:inline-flex"
        >
          <GripVertical aria-hidden="true" className="h-4 w-4" />
        </button>
        <Switch
          checked={filter.enabled}
          onCheckedChange={(enabled) => onPatch(filter.id, filter.kind, { enabled })}
          aria-label={t("filter.enable")}
          className="mt-2 shrink-0"
        />
        <FilterSelect
          ariaLabel={t("filter.modeLabel")}
          value={filter.mode}
          onValueChange={(mode) => onPatch(filter.id, filter.kind, { mode })}
          className={clsx("shrink-0", filterSelectTextClass, isEnglish ? "w-24" : "w-[84px]")}
          itemClassName={filterSelectTextClass}
          options={modeOptions}
        />
        <FilterSelect
          ariaLabel={t("filter.typeLabel")}
          value={filter.kind}
          onValueChange={(kind) => onKindChange(filter.id, kind)}
          className={clsx("shrink-0", filterSelectTextClass, isEnglish ? "w-36" : "w-[122px]")}
          itemClassName={filterSelectTextClass}
          options={kindOptions}
        />
        <FilterValueEditor
          filter={filter}
          tabs={tabs}
          currentTabId={currentTabId}
          autoFocus={autoFocusValue}
          onChange={(value) => onPatch(filter.id, filter.kind, { value })}
        />
        <button
          type="button"
          aria-label={t("filter.delete")}
          onClick={() => onDelete(filter.id)}
          className="mt-0.5 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={t("common.more")}
              className="mt-0.5 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-[100] min-w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
            >
              <DropdownMenu.Group>
                <DropdownMenu.Item
                  className={menuItemClass}
                  onSelect={() => {
                    if (commentVisible) {
                      setShowComment(false);
                      onPatch(filter.id, filter.kind, { comment: "" });
                      return;
                    }
                    setShowComment(true);
                    window.setTimeout(() => commentRef.current?.focus(), 0);
                  }}
                >
                  {commentVisible ? (
                    <MessageSquareX aria-hidden="true" className="h-3.5 w-3.5" />
                  ) : (
                    <MessageSquarePlus aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                  {t(commentVisible ? "common.removeComment" : "common.addComment")}
                </DropdownMenu.Item>
              </DropdownMenu.Group>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      {commentVisible && (
        <div className="mt-2 pl-0 sm:pl-10">
          <Input
            ref={commentRef}
            aria-label={t("common.comment")}
            className="h-8 border-dashed border-slate-200 bg-transparent text-xs font-normal text-slate-500 shadow-none"
            placeholder={t("common.commentPlaceholder")}
            value={filter.comment}
            onChange={(event) => {
              setShowComment(true);
              onPatch(filter.id, filter.kind, { comment: event.target.value });
            }}
          />
        </div>
      )}
    </div>
  );
}

export const FilterRow = memo(FilterRowComponent);
