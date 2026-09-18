import { useCallback, useState } from "react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { createCookieRule } from "../../../../services/rules/cookie/cookie-parser";
import type { NameValueRule } from "../../../../types/profile/profile-model";
import { useEditorController } from "../../editor-controller";
import { CookieRuleRow } from "../rules/CookieRuleRow";
import { EmptyState } from "../shared/EmptyState";
import { SectionContent } from "./SectionContent";
import { SectionHeader } from "./SectionHeader";

export function CookieSection({
  profileId,
  cookies,
  searchQuery,
  focusCookieId,
  compact = false,
}: {
  profileId: string;
  cookies: NameValueRule[];
  searchQuery: string;
  focusCookieId?: string | null;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { actions } = useEditorController();
  const { addRule, patchRule, deleteRule, cloneRule, setRulesEnabled, clearRules } = actions;
  const [open, setOpen] = useState(true);
  const [localFocusCookieId, setLocalFocusCookieId] = useState<string | null>(null);
  const query = searchQuery.trim().toLowerCase();
  const visibleCookies = cookies.filter(
    (cookie) =>
      !query || `${cookie.name} ${cookie.value} ${cookie.comment}`.toLowerCase().includes(query),
  );
  const enabled = cookies.some((cookie) => cookie.enabled);
  const handleChange = useCallback(
    (ruleId: string, patch: Partial<NameValueRule>) =>
      void patchRule(profileId, "cookies", ruleId, patch),
    [patchRule, profileId],
  );
  const handleDelete = useCallback(
    (ruleId: string) => void deleteRule(profileId, "cookies", ruleId),
    [deleteRule, profileId],
  );
  const handleClone = useCallback(
    (ruleId: string) => {
      const cloneId = createCookieRule().id;
      setLocalFocusCookieId(cloneId);
      void cloneRule(profileId, "cookies", ruleId, cloneId);
    },
    [cloneRule, profileId],
  );

  return (
    <section>
      <SectionHeader
        title={t("section.cookies")}
        count={cookies.length}
        open={open}
        enabled={enabled}
        onToggle={() => setOpen((current) => !current)}
        onToggleEnabled={() => void setRulesEnabled(profileId, "cookies", !enabled)}
        onAdd={() => {
          const cookie = createCookieRule();
          setLocalFocusCookieId(cookie.id);
          void addRule(profileId, "cookies", cookie);
          setOpen(true);
        }}
        onClear={() => void clearRules(profileId, "cookies")}
      />
      <SectionContent open={open} className={clsx(compact ? "space-y-1.5" : "space-y-2")}>
        {visibleCookies.map((cookie) => (
          <CookieRuleRow
            key={cookie.id}
            cookie={cookie}
            compact={compact}
            autoFocus={cookie.id === focusCookieId || cookie.id === localFocusCookieId}
            onChange={handleChange}
            onDelete={handleDelete}
            onClone={handleClone}
          />
        ))}
        {!compact && cookies.length === 0 && (
          <EmptyState label={t("section.noRules", { title: t("section.cookies") })} />
        )}
        {cookies.length > 0 && visibleCookies.length === 0 && (
          <EmptyState label={t("section.noMatchedRules")} />
        )}
      </SectionContent>
    </section>
  );
}
