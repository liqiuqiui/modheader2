import { useCallback, useState } from "react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import type { CookieRule, ProfileRuleCollection } from "../../../../types/profile/profile-model";
import { createCookieRule } from "../../../../types/profile/profile-factory";
import { useEditorController } from "../../editor-controller";
import { CookieRuleRow } from "../rules/CookieRuleRow";
import { EmptyState } from "../shared/EmptyState";
import { SectionContent } from "./SectionContent";
import { SectionHeader } from "./SectionHeader";

export function CookieSection({
  profileId,
  collection = "cookies",
  title,
  cookies,
  searchQuery,
  focusCookieId,
  compact = false,
}: {
  profileId: string;
  collection?: Extract<ProfileRuleCollection, "cookies" | "setCookies">;
  title?: string;
  cookies: CookieRule[];
  searchQuery: string;
  focusCookieId?: string | null;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { actions } = useEditorController();
  const { addRule, patchRule, deleteRule, cloneRule, setRulesEnabled, clearRules } = actions;
  const [open, setOpen] = useState(true);
  const [localFocusCookieId, setLocalFocusCookieId] = useState<string | null>(null);
  const sectionTitle = title ?? t("section.cookies");
  const isSetCookie = collection === "setCookies";
  const query = searchQuery.trim().toLowerCase();
  const visibleCookies = cookies.filter(
    (cookie) =>
      !query || `${cookie.name} ${cookie.value} ${cookie.comment}`.toLowerCase().includes(query),
  );
  const enabled = cookies.some((cookie) => cookie.enabled);
  const handleChange = useCallback(
    (ruleId: string, patch: Partial<CookieRule>) =>
      void patchRule(profileId, collection, ruleId, patch),
    [collection, patchRule, profileId],
  );
  const handleDelete = useCallback(
    (ruleId: string) => void deleteRule(profileId, collection, ruleId),
    [collection, deleteRule, profileId],
  );
  const handleClone = useCallback(
    (ruleId: string) => {
      const cloneId = createCookieRule().id;
      setLocalFocusCookieId(cloneId);
      void cloneRule(profileId, collection, ruleId, cloneId);
    },
    [cloneRule, collection, profileId],
  );

  return (
    <section>
      <SectionHeader
        title={sectionTitle}
        count={cookies.length}
        open={open}
        enabled={enabled}
        onToggle={() => setOpen((current) => !current)}
        onToggleEnabled={() => void setRulesEnabled(profileId, collection, !enabled)}
        onAdd={() => {
          const cookie = createCookieRule();
          setLocalFocusCookieId(cookie.id);
          void addRule(profileId, collection, cookie);
          setOpen(true);
        }}
        onClear={() => void clearRules(profileId, collection)}
      />
      <SectionContent open={open} className={clsx(compact ? "space-y-1.5" : "space-y-2")}>
        {visibleCookies.map((cookie) => (
          <CookieRuleRow
            key={cookie.id}
            cookie={cookie}
            compact={compact}
            showWriteMode={!isSetCookie}
            autoFocus={cookie.id === focusCookieId || cookie.id === localFocusCookieId}
            onChange={handleChange}
            onDelete={handleDelete}
            onClone={handleClone}
          />
        ))}
        {!compact && cookies.length === 0 && (
          <EmptyState label={t("section.noRules", { title: sectionTitle })} />
        )}
        {cookies.length > 0 && visibleCookies.length === 0 && (
          <EmptyState label={t("section.noMatchedRules")} />
        )}
      </SectionContent>
    </section>
  );
}
