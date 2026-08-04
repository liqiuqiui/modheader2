import { useEffect } from "react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { isContentSecurityPolicyRule } from "../../../modules/profile/domain/profile-csp";
import { selectSelectedProfile } from "../../../modules/profile/state/profile-selectors";
import { useProfileStore } from "../../../modules/profile/state/profile-store";
import { useBrowserTabsStore } from "../stores/browser-tabs-store";
import { useEditorUiStore } from "../stores/editor-ui-store";
import type { EditorMode } from "../types";
import { CookieSection } from "./CookieSection";
import { CspSection } from "./CspSection";
import { FilterSection } from "./FilterSection";
import { HeaderSection } from "./HeaderSection";
import { RedirectSection } from "./RedirectSection";

export function EditorSections({ mode }: { mode: EditorMode }) {
  const { t } = useTranslation();
  const profile = useProfileStore(selectSelectedProfile);
  const tabs = useBrowserTabsStore((state) => state.tabs);
  const currentTabId = useBrowserTabsStore((state) => state.currentTabId);
  const searchQuery = useEditorUiStore((state) => state.searchQuery);
  const focusRequest = useEditorUiStore((state) => state.focusRequest);
  const clearFocusRequest = useEditorUiStore((state) => state.clearFocusRequest);
  const compact = mode === "popup";

  useEffect(() => {
    if (!focusRequest) return;
    const frame = window.requestAnimationFrame(clearFocusRequest);
    return () => window.cancelAnimationFrame(frame);
  }, [clearFocusRequest, focusRequest]);

  if (!profile) return null;

  const responseHeaders = profile.respHeaders.filter((rule) => !isContentSecurityPolicyRule(rule));
  const contentSecurityPolicyRules = profile.respHeaders.filter(isContentSecurityPolicyRule);

  return (
    <div className={clsx(compact ? "space-y-2.5" : "space-y-4")}>
      <HeaderSection
        profileId={profile.id}
        title={t("section.requestHeaders")}
        collection="headers"
        rules={profile.headers}
        searchQuery={searchQuery}
        focusRuleId={focusRequest?.kind === "header" ? focusRequest.id : null}
        convertLabel={t("header.convertToResponse")}
        compact={compact}
      />
      {profile.cookies.length > 0 && (
        <CookieSection
          profileId={profile.id}
          cookies={profile.cookies}
          searchQuery={searchQuery}
          focusCookieId={focusRequest?.kind === "cookie" ? focusRequest.id : null}
          compact={compact}
        />
      )}
      {responseHeaders.length > 0 && (
        <HeaderSection
          profileId={profile.id}
          title={t("section.responseHeaders")}
          collection="respHeaders"
          rules={responseHeaders}
          searchQuery={searchQuery}
          focusRuleId={focusRequest?.kind === "header" ? focusRequest.id : null}
          convertLabel={t("header.convertToRequest")}
          compact={compact}
        />
      )}
      {contentSecurityPolicyRules.length > 0 && (
        <CspSection
          profileId={profile.id}
          rules={contentSecurityPolicyRules}
          searchQuery={searchQuery}
          focusRuleId={focusRequest?.kind === "csp" ? focusRequest.id : null}
          compact={compact}
        />
      )}
      {profile.urlReplacements.length > 0 && (
        <RedirectSection
          profileId={profile.id}
          replacements={profile.urlReplacements}
          searchQuery={searchQuery}
        />
      )}
      <FilterSection
        profile={profile}
        tabs={tabs}
        currentTabId={currentTabId}
        searchQuery={searchQuery}
        focusFilterId={focusRequest?.kind === "filter" ? focusRequest.id : null}
        compact={compact}
      />
    </div>
  );
}
