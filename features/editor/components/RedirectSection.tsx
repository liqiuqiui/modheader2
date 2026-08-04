import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createUrlReplacement } from "../../../modules/profile/domain/profile-factory";
import type { UrlReplacement } from "../../../modules/profile/domain/profile-model";
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
  replacements: UrlReplacement[];
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
  return (
    <section>
      <SectionHeader
        title={t("section.urlRedirects")}
        count={replacements.length}
        open={open}
        enabled={enabled}
        onToggle={() => setOpen((current) => !current)}
        onToggleEnabled={() => void setRulesEnabled(profileId, "urlReplacements", !enabled)}
        onAdd={() => {
          void addRule(profileId, "urlReplacements", createUrlReplacement());
          setOpen(true);
        }}
        onClear={() => void clearRules(profileId, "urlReplacements")}
      />
      <SectionContent open={open} className="space-y-2">
        {visible.map((item) => (
          <RedirectRuleRow
            key={item.id}
            replacement={item}
            onChange={(patch) => void patchRule(profileId, "urlReplacements", item.id, patch)}
            onDelete={() => void deleteRule(profileId, "urlReplacements", item.id)}
          />
        ))}
        {replacements.length === 0 && <EmptyState label={t("redirect.none")} />}
      </SectionContent>
    </section>
  );
}
