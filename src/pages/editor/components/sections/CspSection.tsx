import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import {
  CONTENT_SECURITY_POLICY_HEADER,
  createCspRule,
} from "../../../../services/rules/csp/csp-parser";
import type { CspRule } from "../../../../types/profile/profile-model";
import { useEditorController } from "../../editor-controller";
import { CspRuleRow } from "../rules/CspRuleRow";
import { EmptyState } from "../shared/EmptyState";
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
  rules: CspRule[];
  searchQuery: string;
  focusRuleId?: string | null;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { actions } = useEditorController();
  const { addRule, patchRule, deleteRule, cloneRule, setRulesEnabled, clearRules } = actions;
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
        `${aliases} ${rule.directive} ${rule.value} ${rule.comment}`.toLowerCase().includes(query),
    );
  }, [focusRuleId, localFocusRuleId, rules, searchQuery, t, title]);
  const enabled = rules.some((rule) => rule.enabled);
  const handleChange = useCallback(
    (ruleId: string, patch: Partial<CspRule>) => void patchRule(profileId, "csp", ruleId, patch),
    [patchRule, profileId],
  );
  const handleDelete = useCallback(
    (ruleId: string) => void deleteRule(profileId, "csp", ruleId),
    [deleteRule, profileId],
  );
  const handleFocusLeave = useCallback((ruleId: string) => {
    setLocalFocusRuleId((current) => (current === ruleId ? null : current));
  }, []);
  const handleClone = useCallback(
    (ruleId: string) => {
      const cloneId = createCspRule().id;
      setLocalFocusRuleId(cloneId);
      void cloneRule(profileId, "csp", ruleId, cloneId);
      setOpen(true);
    },
    [cloneRule, profileId],
  );

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
            onChange={handleChange}
            onDelete={handleDelete}
            onFocusLeave={handleFocusLeave}
            onClone={handleClone}
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
