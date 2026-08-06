import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { createRedirectRule } from "../../../modules/profile/domain/profile-factory";
import type { NameValueRule } from "../../../modules/profile/domain/profile-model";
import { useProfileStore } from "../../../modules/profile/state/profile-store";
import { EmptyState } from "./EmptyState";
import { RedirectRuleRow } from "./RedirectRuleRow";
import { SectionContent } from "./SectionContent";
import { SectionHeader } from "./SectionHeader";

export function RedirectSection({
  profileId,
  replacements,
  searchQuery,
}: {
  profileId: string;
  replacements: NameValueRule[];
  searchQuery: string;
}) {
  const { t } = useTranslation();
  const addRule = useProfileStore((state) => state.addRule);
  const patchRule = useProfileStore((state) => state.patchRule);
  const deleteRule = useProfileStore((state) => state.deleteRule);
  const setRulesEnabled = useProfileStore((state) => state.setRulesEnabled);
  const clearRules = useProfileStore((state) => state.clearRules);
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
      <SectionContent open={open} className="space-y-2">
        {visible.map((item) => (
          <RedirectRuleRow
            key={item.id}
            replacement={item}
            onChange={handleChange}
            onDelete={handleDelete}
          />
        ))}
        {replacements.length === 0 && <EmptyState label={t("redirect.none")} />}
      </SectionContent>
    </section>
  );
}
