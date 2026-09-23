import { useEffect } from "react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { useEditorController } from "../../editor-controller";
import type { EditorMode } from "../../types";
import { CookieSection } from "../sections/CookieSection";
import { CspSection } from "../sections/CspSection";
import { FilterSection } from "../sections/FilterSection";
import { HeaderSection } from "../sections/HeaderSection";
import { RedirectSection } from "../sections/RedirectSection";

export function EditorSections({ mode }: { mode: EditorMode }) {
  const { t } = useTranslation();
  const {
    profile,
    tabs,
    tabGroups,
    tabGroupsAvailable,
    currentTabId,
    searchQuery,
    focusRequest,
    clearFocusRequest,
  } = useEditorController();
  const compact = mode === "popup";

  useEffect(() => {
    if (!focusRequest) return;
    const frame = window.requestAnimationFrame(clearFocusRequest);
    return () => window.cancelAnimationFrame(frame);
  }, [clearFocusRequest, focusRequest]);

  if (!profile) return null;
  const { requestHeaders, responseHeaders, csp, cookies, redirects } = profile.rules;

  return (
    <div className={clsx(compact ? "space-y-2.5" : "space-y-4")}>
      <HeaderSection
        profileId={profile.id}
        title={t("section.requestHeaders")}
        collection="requestHeaders"
        rules={requestHeaders}
        searchQuery={searchQuery}
        focusRuleId={focusRequest?.kind === "header" ? focusRequest.id : null}
        convertLabel={t("header.convertToResponse")}
        compact={compact}
      />
      {cookies.length > 0 && (
        <CookieSection
          profileId={profile.id}
          cookies={cookies}
          searchQuery={searchQuery}
          focusCookieId={focusRequest?.kind === "cookie" ? focusRequest.id : null}
          compact={compact}
        />
      )}
      {responseHeaders.length > 0 && (
        <HeaderSection
          profileId={profile.id}
          title={t("section.responseHeaders")}
          collection="responseHeaders"
          rules={responseHeaders}
          searchQuery={searchQuery}
          focusRuleId={focusRequest?.kind === "header" ? focusRequest.id : null}
          convertLabel={t("header.convertToRequest")}
          compact={compact}
        />
      )}
      {csp.length > 0 && (
        <CspSection
          profileId={profile.id}
          rules={csp}
          searchQuery={searchQuery}
          focusRuleId={focusRequest?.kind === "csp" ? focusRequest.id : null}
          compact={compact}
        />
      )}
      {redirects.length > 0 && (
        <RedirectSection
          profileId={profile.id}
          replacements={redirects}
          searchQuery={searchQuery}
        />
      )}
      <FilterSection
        profile={profile}
        tabs={tabs}
        tabGroups={tabGroups}
        tabGroupsAvailable={tabGroupsAvailable}
        currentTabId={currentTabId}
        searchQuery={searchQuery}
        focusFilterId={focusRequest?.kind === "filter" ? focusRequest.id : null}
        compact={compact}
      />
    </div>
  );
}
