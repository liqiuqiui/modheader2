import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { clsx } from "clsx";
import { Copy, MoreHorizontal, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Switch } from "../../../components/ui/switch";
import type { CookieRule } from "../../../types";
import { menuItemClass } from "./styles";

export function CookieRuleRow({
  cookie,
  compact,
  autoFocus,
  onChange,
  onDelete,
  onClone,
}: {
  cookie: CookieRule;
  compact: boolean;
  autoFocus: boolean;
  onChange: (patch: Partial<CookieRule>) => void;
  onDelete: () => void;
  onClone: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={clsx(
        "group flex items-center gap-2 rounded-lg border border-slate-200 bg-white",
        compact ? "p-1.5 shadow-sm" : "p-2.5 shadow-sm",
        !cookie.enabled && "opacity-60",
      )}
    >
      <Switch
        checked={cookie.enabled}
        onCheckedChange={(enabled) => onChange({ enabled })}
        aria-label={t("cookie.enable")}
        className="shrink-0"
      />
      <input
        aria-label={t("cookie.name")}
        className={clsx(
          compact ? "h-8" : "h-9",
          "min-w-0 flex-[0.85] rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs font-semibold outline-none transition hover:bg-white focus:ring-2 focus:ring-[var(--theme-color)]",
        )}
        placeholder={t("cookie.namePlaceholder")}
        value={cookie.name}
        autoFocus={autoFocus}
        onChange={(event) => onChange({ name: event.target.value })}
        spellCheck={false}
      />
      <input
        aria-label={t("cookie.value")}
        className={clsx(
          compact ? "h-8" : "h-9",
          "min-w-0 flex-[1.4] rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs outline-none transition hover:bg-white focus:ring-2 focus:ring-[var(--theme-color)]",
        )}
        placeholder={t("cookie.valuePlaceholder")}
        value={cookie.value}
        onChange={(event) => onChange({ value: event.target.value })}
        spellCheck={false}
      />
      <button
        type="button"
        aria-label={t("cookie.delete")}
        onClick={onDelete}
        className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={t("common.more")}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
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
            <DropdownMenu.Item className={menuItemClass} onSelect={onClone}>
              <Copy aria-hidden="true" className="h-3.5 w-3.5" /> {t("cookie.clone")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
