import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { clsx } from "clsx";
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { iconButtonClass, menuItemClass } from "./styles";

export function LanguageMenu({
  locale,
  onLanguageChange,
}: {
  locale: "en" | "zh-CN";
  onLanguageChange: (locale: "en" | "zh-CN") => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          title={t("common.language")}
          aria-label={t("common.language")}
          className={clsx(iconButtonClass(), "flex items-center gap-1 text-xs font-semibold")}
        >
          <Languages aria-hidden="true" className="h-4 w-4" /> {locale === "zh-CN" ? "中" : "EN"}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-[100] min-w-36 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl"
        >
          <DropdownMenu.Item className={menuItemClass} onSelect={() => onLanguageChange("zh-CN")}>
            <span className="w-5 text-center">中</span> {t("common.chinese")}
          </DropdownMenu.Item>
          <DropdownMenu.Item className={menuItemClass} onSelect={() => onLanguageChange("en")}>
            <span className="w-5 text-center">EN</span> {t("common.english")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
