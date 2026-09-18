import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Filter, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { createCspRule } from "../../../../services/rules/csp/csp-parser";
import { createCookieRule } from "../../../../services/rules/cookie/cookie-parser";
import { createRedirectRule } from "../../../../services/rules/redirect/redirect-parser";
import { createFilter } from "../../../../services/rules/filter/filter-parser";
import { createHeaderRule } from "../../../../services/rules/header/header-parser";
import { useEditorController } from "../../editor-controller";
import { menuItemClass } from "../shared/styles";

export function QuickAddActions() {
  const { t } = useTranslation();
  const {
    selectedProfileId: profileId,
    actions,
    requestFocus,
    currentTabId,
  } = useEditorController();
  const { addRule, addFilter } = actions;
  if (!profileId) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--theme-color)] px-4 text-xs font-bold text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)]"
          >
            <Plus aria-hidden="true" className="h-4 w-4" /> {t("mod.quickAdd")}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-[100] min-w-[180px] rounded-xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl"
          >
            <DropdownMenu.Label className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
              {t("mod.title")}
            </DropdownMenu.Label>
            <DropdownMenu.Item
              className={menuItemClass}
              onSelect={() => {
                const nextRule = createHeaderRule();
                requestFocus("header", nextRule.id);
                void addRule(profileId, "requestHeaders", nextRule);
              }}
            >
              {t("section.requestHeaders")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={menuItemClass}
              onSelect={() => {
                const nextRule = createHeaderRule();
                requestFocus("header", nextRule.id);
                void addRule(profileId, "responseHeaders", nextRule);
              }}
            >
              {t("section.responseHeaders")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={menuItemClass}
              onSelect={() => {
                const cookie = createCookieRule();
                requestFocus("cookie", cookie.id);
                void addRule(profileId, "cookies", cookie);
              }}
            >
              {t("mod.cookies")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={menuItemClass}
              onSelect={() => void addRule(profileId, "redirects", createRedirectRule())}
            >
              {t("section.urlRedirects")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={menuItemClass}
              onSelect={() => {
                const nextRule = createCspRule();
                requestFocus("csp", nextRule.id);
                void addRule(profileId, "csp", nextRule);
              }}
            >
              {t("mod.csp")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <button
        type="button"
        onClick={() => {
          const nextFilter = createFilter({
            kind: "tab",
            mode: "include",
            currentTabId,
          });
          requestFocus("filter", nextFilter.id);
          void addFilter(profileId, nextFilter);
        }}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)]"
      >
        <Filter aria-hidden="true" className="h-4 w-4" /> {t("filter.quickAdd")}
      </button>
    </div>
  );
}
