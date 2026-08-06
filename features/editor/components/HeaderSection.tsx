import { useCallback, useMemo, useState } from "react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { HeaderRuleRow } from "../../../components/HeaderRuleRow";
import { isContentSecurityPolicyHeaderName } from "../../../modules/profile/domain/profile-csp";
import { createHeaderRule } from "../../../modules/profile/domain/profile-factory";
import type {
  HeaderRule,
  ProfileRuleCollection,
} from "../../../modules/profile/domain/profile-model";
import { useProfileStore } from "../../../modules/profile/state/profile-store";
import { REQUEST_HEADER_NAME_SUGGESTIONS, RESPONSE_HEADER_NAME_SUGGESTIONS } from "../constants";
import { useEditorUiStore } from "../stores/editor-ui-store";
import { EmptyState } from "./EmptyState";
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
  const addRule = useProfileStore((state) => state.addRule);
  const patchRule = useProfileStore((state) => state.patchRule);
  const deleteRule = useProfileStore((state) => state.deleteRule);
  const cloneRule = useProfileStore((state) => state.cloneRule);
  const setRulesEnabled = useProfileStore((state) => state.setRulesEnabled);
  const clearRules = useProfileStore((state) => state.clearRules);
  const convertHeader = useProfileStore((state) => state.convertHeader);
  const requestFocus = useEditorUiStore((state) => state.requestFocus);
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
