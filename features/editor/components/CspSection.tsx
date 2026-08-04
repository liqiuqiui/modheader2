import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { CONTENT_SECURITY_POLICY_HEADER } from "../../../modules/profile/domain/profile-csp";
import { createCspRule } from "../../../modules/profile/domain/profile-factory";
import type { HeaderRule } from "../../../modules/profile/domain/profile-model";
import { useProfileStore } from "../../../modules/profile/state/profile-store";
import { CspRuleRow } from "./CspRuleRow";
import { EmptyState } from "./EmptyState";
import { SectionContent } from "./SectionContent";
import { SectionHeader } from "./SectionHeader";

export function CspSection({
  profileId,
  rules,
  searchQuery,
  focusRuleId,
  compact = false,
}: {
  profileId: string;
  rules: HeaderRule[];
  searchQuery: string;
  focusRuleId?: string | null;
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
  const [localFocusRuleId, setLocalFocusRuleId] = useState<string | null>(null);
  const title = t("section.csp");

  useEffect(() => {
    if (!focusRuleId) return;
    setLocalFocusRuleId(focusRuleId);
    setOpen(true);
  }, [focusRuleId]);

  const visibleRules = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rules;
    const aliases = `${CONTENT_SECURITY_POLICY_HEADER} Content Security Policy CSP ${title} ${t("mod.csp")}`;
    return rules.filter(
      (rule) =>
        rule.id === focusRuleId ||
        rule.id === localFocusRuleId ||
        `${aliases} ${rule.value} ${rule.comment}`.toLowerCase().includes(query),
    );
  }, [focusRuleId, localFocusRuleId, rules, searchQuery, t, title]);
  const enabled = rules.some((rule) => rule.enabled);

  return (
    <section aria-label={title}>
      <SectionHeader
        title={title}
        count={rules.length}
        open={open}
        enabled={enabled}
        onToggle={() => setOpen((current) => !current)}
        onToggleEnabled={() => void setRulesEnabled(profileId, "csp", !enabled)}
        onAdd={() => {
          const nextRule = createCspRule();
          setLocalFocusRuleId(nextRule.id);
          void addRule(profileId, "csp", nextRule);
          setOpen(true);
        }}
        onClear={() => void clearRules(profileId, "csp")}
      />
      <SectionContent open={open} className={clsx(compact ? "space-y-1.5" : "space-y-2")}>
        {visibleRules.map((rule) => (
          <CspRuleRow
            key={rule.id}
            rule={rule}
            autoFocus={rule.id === focusRuleId || rule.id === localFocusRuleId}
            onChange={(patch) => void patchRule(profileId, "csp", rule.id, patch)}
            onDelete={() => void deleteRule(profileId, "csp", rule.id)}
            onFocusLeave={() =>
              setLocalFocusRuleId((current) => (current === rule.id ? null : current))
            }
            onClone={() => {
              const cloneId = createCspRule().id;
              setLocalFocusRuleId(cloneId);
              void cloneRule(profileId, "csp", rule.id, cloneId);
              setOpen(true);
            }}
            compact={compact}
          />
        ))}
        {!compact && rules.length === 0 && <EmptyState label={t("section.noRules", { title })} />}
        {rules.length > 0 && visibleRules.length === 0 && (
          <EmptyState label={t("section.noMatchedRules")} />
        )}
      </SectionContent>
    </section>
  );
}
