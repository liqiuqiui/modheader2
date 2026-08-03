import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createUrlReplacement } from "../../../types";
import type { UrlReplacement } from "../../../types";
import { EmptyState } from "./EmptyState";
import { RedirectRuleRow } from "./RedirectRuleRow";
import { SectionContent } from "./SectionContent";
import { SectionHeader } from "./SectionHeader";

export function RedirectSection({
  replacements,
  searchQuery,
  onChange,
}: {
  replacements: UrlReplacement[];
  searchQuery: string;
  onChange: (replacements: UrlReplacement[]) => void;
}) {
  const { t } = useTranslation();
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
        onToggleEnabled={() =>
          onChange(replacements.map((item) => ({ ...item, enabled: !enabled })))
        }
        onAdd={() => {
          onChange([...replacements, createUrlReplacement()]);
          setOpen(true);
        }}
        onClear={() => onChange([])}
      />
      <SectionContent open={open} className="space-y-2">
        {visible.map((item) => (
          <RedirectRuleRow
            key={item.id}
            replacement={item}
            onChange={(patch) =>
              onChange(
                replacements.map((current) =>
                  current.id === item.id ? { ...current, ...patch } : current,
                ),
              )
            }
            onDelete={() => onChange(replacements.filter((current) => current.id !== item.id))}
          />
        ))}
        {replacements.length === 0 && <EmptyState label={t("redirect.none")} />}
      </SectionContent>
    </section>
  );
}
