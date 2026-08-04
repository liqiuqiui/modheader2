import { useState } from "react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { createCookieRule } from "../../../modules/profile/domain/profile-factory";
import type { CookieRule } from "../../../modules/profile/domain/profile-model";
import { useProfileStore } from "../../../modules/profile/state/profile-store";
import { CookieRuleRow } from "./CookieRuleRow";
import { EmptyState } from "./EmptyState";
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
  cookies: CookieRule[];
  searchQuery: string;
  focusCookieId?: string | null;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const addRule = useProfileStore((state) => state.addRule);
  const patchRule = useProfileStore((state) => state.patchRule);
  const deleteRule = useProfileStore((state) => state.deleteRule);
  const cloneRule = useProfileStore((state) => state.cloneRule);
  const setRulesEnabled = useProfileStore((state) => state.setRulesEnabled);
  const clearRules = useProfileStore((state) => state.clearRules);
  const [open, setOpen] = useState(true);
  const [localFocusCookieId, setLocalFocusCookieId] = useState<string | null>(null);
  const query = searchQuery.trim().toLowerCase();
  const visibleCookies = cookies.filter(
    (cookie) =>
      !query || `${cookie.name} ${cookie.value} ${cookie.comment}`.toLowerCase().includes(query),
  );
  const enabled = cookies.some((cookie) => cookie.enabled);

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
            onChange={(patch) => void patchRule(profileId, "cookies", cookie.id, patch)}
            onDelete={() => void deleteRule(profileId, "cookies", cookie.id)}
            onClone={() => {
              const cloneId = createCookieRule().id;
              setLocalFocusCookieId(cloneId);
              void cloneRule(profileId, "cookies", cookie.id, cloneId);
            }}
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
