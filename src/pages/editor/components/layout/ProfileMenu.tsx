import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { clsx } from "clsx";
import { Copy, FileDown, GitMerge, MoreVertical, Palette, Pencil, Pin, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { iconButtonClass, menuItemClass } from "../shared/styles";

export function ProfileMenu({
  alwaysOn,
  onToggleAlwaysOn,
  onSortByTitle,
  onRename,
  onClone,
  onPickColor,
  onExport,
  onCopy,
  onDelete,
  onCloseAutoFocus,
}: {
  alwaysOn: boolean;
  onToggleAlwaysOn: () => void;
  onSortByTitle: () => void;
  onRename: () => void;
  onClone: () => void;
  onPickColor: () => void;
  onExport: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          title={t("toolbar.profileMenu")}
          aria-label={t("toolbar.profileMenu")}
          className={iconButtonClass()}
        >
          <MoreVertical aria-hidden="true" className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          onCloseAutoFocus={onCloseAutoFocus}
          className="z-[100] min-w-52 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl"
        >
          <DropdownMenu.Item className={menuItemClass} onSelect={onRename}>
            <Pencil aria-hidden="true" className="h-4 w-4" /> {t("profile.rename")}
          </DropdownMenu.Item>
          <DropdownMenu.Item className={menuItemClass} onSelect={onClone}>
            <Copy aria-hidden="true" className="h-4 w-4" /> {t("profile.clone")}
          </DropdownMenu.Item>
          <DropdownMenu.Item className={menuItemClass} onSelect={onPickColor}>
            <Palette aria-hidden="true" className="h-4 w-4" /> {t("profile.changeColor")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={menuItemClass}
            onSelect={onToggleAlwaysOn}
            title={t("profile.alwaysOnHint")}
          >
            <Pin aria-hidden="true" className="h-4 w-4" />
            <span className="flex-1">{t("profile.alwaysOn")}</span>
            <span aria-hidden="true" className="text-[10px] text-slate-400">
              {alwaysOn ? "ON" : "OFF"}
            </span>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
          <DropdownMenu.Item className={menuItemClass} onSelect={onSortByTitle}>
            <GitMerge aria-hidden="true" className="h-4 w-4" /> {t("profile.sortByTitle")}
          </DropdownMenu.Item>
          <DropdownMenu.Item className={menuItemClass} onSelect={onExport}>
            <FileDown aria-hidden="true" className="h-4 w-4" /> {t("profile.exportFile")}
          </DropdownMenu.Item>
          <DropdownMenu.Item className={menuItemClass} onSelect={onCopy}>
            <Copy aria-hidden="true" className="h-4 w-4" /> {t("profile.copy")}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
          <DropdownMenu.Item className={clsx(menuItemClass, "text-rose-600")} onSelect={onDelete}>
            <Trash2 aria-hidden="true" className="h-4 w-4" /> {t("profile.delete")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
