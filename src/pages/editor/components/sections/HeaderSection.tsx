import { useCallback, useMemo, useState } from "react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { HeaderRuleRow } from "../rules/HeaderRuleRow";
import {
  createHeaderRule,
  isContentSecurityPolicyHeaderName,
} from "../../../../services/rules/header/header-parser";
import type { HeaderRule, ProfileRuleCollection } from "../../../../types/profile/profile-model";
import { useEditorController } from "../../editor-controller";
import { REQUEST_HEADER_NAME_SUGGESTIONS, RESPONSE_HEADER_NAME_SUGGESTIONS } from "../../constants";
import { EmptyState } from "../shared/EmptyState";
import { SectionContent } from "./SectionContent";
import { SectionHeader } from "./SectionHeader";

export function HeaderSection({
  profileId,
  title,
  collection,
  rules,
  searchQuery,
  focusRuleId,
  convertLabel,
  compact = false,
}: {
  profileId: string;
  title: string;
  collection: Extract<ProfileRuleCollection, "requestHeaders" | "responseHeaders">;
  rules: HeaderRule[];
  searchQuery: string;
  focusRuleId?: string | null;
  convertLabel?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { actions, requestFocus } = useEditorController();
  const { addRule, patchRule, deleteRule, cloneRule, setRulesEnabled, clearRules, convertHeader } =
    actions;
  const [open, setOpen] = useState(true);
  const [localFocusRuleId, setLocalFocusRuleId] = useState<string | null>(null);
  const visibleRules = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rules;
    return rules.filter((rule) =>
      `${rule.name} ${rule.value} ${rule.comment}`.toLowerCase().includes(query),
    );
  }, [rules, searchQuery]);

  const enabled = rules.some((rule) => rule.enabled);
  const nameSuggestions =
    collection === "requestHeaders"
      ? REQUEST_HEADER_NAME_SUGGESTIONS
      : RESPONSE_HEADER_NAME_SUGGESTIONS;

  const handleChange = useCallback(
    (ruleId: string, patch: Partial<HeaderRule>) => {
      void patchRule(profileId, collection, ruleId, patch);
      if (
        collection === "responseHeaders" &&
        typeof patch.name === "string" &&
        isContentSecurityPolicyHeaderName(patch.name)
      ) {
        requestFocus("csp", ruleId);
      }
    },
    [collection, patchRule, profileId, requestFocus],
  );
  const handleDelete = useCallback(
    (ruleId: string) => void deleteRule(profileId, collection, ruleId),
    [collection, deleteRule, profileId],
  );
  const handleClone = useCallback(
    (ruleId: string) => {
      const cloneId = createHeaderRule().id;
      setLocalFocusRuleId(cloneId);
      void cloneRule(profileId, collection, ruleId, cloneId);
      setOpen(true);
    },
    [cloneRule, collection, profileId],
  );
  const handleConvert = useCallback(
    (ruleId: string) =>
      void convertHeader(
        profileId,
        ruleId,
        collection === "requestHeaders" ? "responseHeaders" : "requestHeaders",
      ),
    [collection, convertHeader, profileId],
  );

  return (
    <section>
      <SectionHeader
        title={title}
        count={rules.length}
        open={open}
        enabled={enabled}
        onToggle={() => setOpen((current) => !current)}
        onToggleEnabled={() => void setRulesEnabled(profileId, collection, !enabled)}
        onAdd={() => {
          const nextRule = createHeaderRule();
          setLocalFocusRuleId(nextRule.id);
          void addRule(profileId, collection, nextRule);
          setOpen(true);
        }}
        onClear={() => void clearRules(profileId, collection)}
      />
      <SectionContent open={open} className={clsx(compact ? "space-y-1.5" : "space-y-2")}>
        {visibleRules.map((rule) => (
          <HeaderRuleRow
            key={rule.id}
            rule={rule}
            nameSuggestions={nameSuggestions}
            autoFocus={rule.id === focusRuleId || rule.id === localFocusRuleId}
            onChange={handleChange}
            onDelete={handleDelete}
            onClone={handleClone}
            convertLabel={convertLabel}
            onConvert={convertLabel ? handleConvert : undefined}
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
