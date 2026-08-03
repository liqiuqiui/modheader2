import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { clsx } from "clsx";
import { Check, ChevronRight, MoreVertical, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { menuItemClass } from "./styles";

export function SectionHeader({
  title,
  count,
  open,
  enabled,
  onToggle,
  onToggleEnabled,
  onAdd,
  onClear,
  enableAllLabel,
  disableAllLabel,
  addLabel,
  moreLabel,
  clearLabel,
  addExpanded,
  addActive = false,
  rotateAddIcon = false,
}: {
  title: string;
  count: number;
  open: boolean;
  enabled: boolean;
  onToggle: () => void;
  onToggleEnabled: () => void;
  onAdd: () => void;
  onClear: () => void;
  enableAllLabel?: string;
  disableAllLabel?: string;
  addLabel?: string;
  moreLabel?: string;
  clearLabel?: string;
  addExpanded?: boolean;
  addActive?: boolean;
  rotateAddIcon?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={clsx(
        "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition-[background-color,margin] duration-200 hover:bg-slate-200/70 has-[:focus-visible]:bg-slate-200/70 motion-reduce:transition-none",
        open && (count > 0 || addExpanded) && "mb-1.5",
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) onToggle();
      }}
    >
      <button
        type="button"
        aria-label={
          enabled
            ? (disableAllLabel ?? t("section.disableAll", { title }))
            : (enableAllLabel ?? t("section.enableAll", { title }))
        }
        onClick={onToggleEnabled}
        className={clsx(
          "flex h-4 w-4 items-center justify-center rounded border transition",
          enabled
            ? "border-[var(--theme-color)] bg-[var(--theme-color)] text-white"
            : "border-slate-300 bg-white text-transparent",
        )}
      >
        <Check aria-hidden="true" className="h-3 w-3" />
      </button>
      <button
        type="button"
        aria-expanded={open}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        onClick={onToggle}
      >
        <ChevronRight
          aria-hidden="true"
          className={clsx(
            "h-4 w-4 text-slate-400 transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-90",
          )}
        />
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
          {title}
        </span>
        <span className="text-[11px] text-slate-400">· {count}</span>
      </button>
      <button
        type="button"
        aria-label={addLabel ?? t("section.add", { title })}
        aria-expanded={addExpanded}
        onClick={onAdd}
        className={clsx(
          "rounded-lg p-1.5 transition hover:bg-white hover:text-[var(--theme-color)]",
          addActive ? "bg-white text-[var(--theme-color)]" : "text-slate-400",
        )}
      >
        <Plus
          aria-hidden="true"
          className={clsx("h-4 w-4 transition", rotateAddIcon && addActive && "rotate-45")}
        />
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={moreLabel ?? t("section.more", { title })}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700"
          >
            <MoreVertical aria-hidden="true" className="h-4 w-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-[100] min-w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
          >
            <DropdownMenu.Item
              className={clsx(menuItemClass, "text-rose-600")}
              onSelect={onClear}
              disabled={count === 0}
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              {clearLabel ?? t("section.clear")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
