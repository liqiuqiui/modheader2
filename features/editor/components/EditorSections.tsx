import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import type { HeaderRule, Profile } from "../../../types";
import type { BrowserTab } from "../../../types/browser";
import type { EditorMode } from "../types";
import { CookieSection } from "./CookieSection";
import { FilterSection } from "./FilterSection";
import { HeaderSection } from "./HeaderSection";
import { RedirectSection } from "./RedirectSection";

export function EditorSections({
  mode,
  profile,
  tabs,
  searchQuery,
  focusHeaderId,
  focusCookieId,
  focusFilterId,
  onUpdate,
  onConvertHeader,
}: {
  mode: EditorMode;
  profile: Profile;
  tabs: BrowserTab[];
  searchQuery: string;
  focusHeaderId?: string | null;
  focusCookieId?: string | null;
  focusFilterId?: string | null;
  onUpdate: (patch: Partial<Profile>) => void;
  onConvertHeader: (rule: HeaderRule, target: "request" | "response") => void;
}) {
  const { t } = useTranslation();
  const compact = mode === "popup";
  return (
    <div className={clsx(compact ? "space-y-2.5" : "space-y-4")}>
      <HeaderSection
        title={t("section.requestHeaders")}
        rules={profile.headers}
        searchQuery={searchQuery}
        focusRuleId={focusHeaderId}
        convertLabel={t("header.convertToResponse")}
        onConvertRule={(rule) => onConvertHeader(rule, "response")}
        onChange={(headers) => onUpdate({ headers })}
        compact={compact}
      />
      {profile.cookies.length > 0 && (
        <CookieSection
          cookies={profile.cookies}
          searchQuery={searchQuery}
          focusCookieId={focusCookieId}
          onChange={(cookies) => onUpdate({ cookies })}
          compact={compact}
        />
      )}
      {profile.respHeaders.length > 0 && (
        <HeaderSection
          title={t("section.responseHeaders")}
          rules={profile.respHeaders}
          searchQuery={searchQuery}
          convertLabel={t("header.convertToRequest")}
          onConvertRule={(rule) => onConvertHeader(rule, "request")}
          onChange={(respHeaders) => onUpdate({ respHeaders })}
          compact={compact}
        />
      )}
      {profile.urlReplacements.length > 0 && (
        <RedirectSection
          replacements={profile.urlReplacements}
          searchQuery={searchQuery}
          onChange={(urlReplacements) => onUpdate({ urlReplacements })}
        />
      )}
      <FilterSection
        profile={profile}
        tabs={tabs}
        searchQuery={searchQuery}
        focusFilterId={focusFilterId}
        onUpdate={onUpdate}
        compact={compact}
      />
    </div>
  );
}
