import { useCallback, useState } from "react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import type { NameValueRule } from "../../../../types/profile/profile-model";
import { createRedirectRule } from "../../../../types/profile/profile-factory";
import { useEditorController } from "../../editor-controller";
import { EmptyState } from "../shared/EmptyState";
import { RedirectRuleRow } from "../rules/RedirectRuleRow";
import { SectionContent } from "./SectionContent";
import { SectionHeader } from "./SectionHeader";

export function RedirectSection({
  profileId,
  replacements,
  searchQuery,
  compact = false,
}: {
  profileId: string;
  replacements: NameValueRule[];
  searchQuery: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { actions } = useEditorController();
  const { addRule, patchRule, deleteRule, setRulesEnabled, clearRules } = actions;
  const [open, setOpen] = useState(true);
  const query = searchQuery.trim().toLowerCase();
  const visible = replacements.filter(
    (item) => !query || `${item.name} ${item.value} ${item.comment}`.toLowerCase().includes(query),
  );
  const enabled = replacements.some((item) => item.enabled);
  const handleChange = useCallback(
    (ruleId: string, patch: Partial<NameValueRule>) =>
      void patchRule(profileId, "redirects", ruleId, patch),
    [patchRule, profileId],
  );
  const handleDelete = useCallback(
    (ruleId: string) => void deleteRule(profileId, "redirects", ruleId),
    [deleteRule, profileId],
  );
  return (
    <section>
      <SectionHeader
        title={t("section.urlRedirects")}
        count={replacements.length}
        open={open}
        enabled={enabled}
        onToggle={() => setOpen((current) => !current)}
        onToggleEnabled={() => void setRulesEnabled(profileId, "redirects", !enabled)}
        onAdd={() => {
          void addRule(profileId, "redirects", createRedirectRule());
          setOpen(true);
        }}
        onClear={() => void clearRules(profileId, "redirects")}
      />
      <SectionContent open={open} className={clsx(compact ? "space-y-1.5" : "space-y-2")}>
        {visible.map((item) => (
          <RedirectRuleRow
            key={item.id}
            replacement={item}
            onChange={handleChange}
            onDelete={handleDelete}
            compact={compact}
          />
        ))}
        {replacements.length === 0 && <EmptyState label={t("redirect.none")} />}
        {replacements.length > 0 && visible.length === 0 && (
          <EmptyState label={t("section.noMatchedRules")} />
        )}
      </SectionContent>
    </section>
  );
}
