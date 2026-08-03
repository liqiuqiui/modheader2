import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { clsx } from "clsx";
import { Filter, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  createCookieRule,
  createHeaderRule,
  createUrlFilter,
  createUrlReplacement,
} from "../../../types";
import type { Profile } from "../../../types";
import type { EditorMode } from "../types";
import { menuItemClass } from "./styles";

export function QuickAddActions({
  mode,
  profile,
  onUpdate,
  onFocusHeader,
  onFocusCookie,
  onFocusFilter,
}: {
  mode: EditorMode;
  profile: Profile;
  onUpdate: (patch: Partial<Profile>) => void;
  onFocusHeader: (id: string) => void;
  onFocusCookie: (id: string) => void;
  onFocusFilter: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={clsx(
        mode === "popup"
          ? "mt-3 flex flex-wrap items-center gap-2"
          : "mt-5 flex flex-wrap items-center gap-2",
      )}
    >
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
                onFocusHeader(nextRule.id);
                onUpdate({ headers: [...profile.headers, nextRule] });
              }}
            >
              {t("section.requestHeaders")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={menuItemClass}
              onSelect={() => {
                const nextRule = createHeaderRule();
                onFocusHeader(nextRule.id);
                onUpdate({ respHeaders: [...profile.respHeaders, nextRule] });
              }}
            >
              {t("section.responseHeaders")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={menuItemClass}
              onSelect={() => {
                const cookie = createCookieRule();
                onFocusCookie(cookie.id);
                onUpdate({ cookies: [...profile.cookies, cookie] });
              }}
            >
              {t("mod.cookies")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={menuItemClass}
              onSelect={() =>
                onUpdate({
                  urlReplacements: [...profile.urlReplacements, createUrlReplacement()],
                })
              }
            >
              {t("section.urlRedirects")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={menuItemClass}
              onSelect={() => {
                const nextRule = createHeaderRule({ name: "Content-Security-Policy" });
                onFocusHeader(nextRule.id);
                onUpdate({ respHeaders: [...profile.respHeaders, nextRule] });
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
          const nextFilter = createUrlFilter({ matchType: "pattern" });
          onFocusFilter(nextFilter.id);
          onUpdate({ urlFilters: [...profile.urlFilters, nextFilter] });
        }}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)]"
      >
        <Filter aria-hidden="true" className="h-4 w-4" /> {t("filter.quickAdd")}
      </button>
    </div>
  );
}
