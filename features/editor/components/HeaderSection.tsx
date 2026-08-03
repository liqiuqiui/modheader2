import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { HeaderRuleRow } from "../../../components/HeaderRuleRow";
import { createHeaderRule } from "../../../types";
import type { HeaderRule } from "../../../types";
import { EmptyState } from "./EmptyState";
import { SectionHeader } from "./SectionHeader";

export function HeaderSection({
  title,
  rules,
  searchQuery,
  onChange,
  focusRuleId,
  convertLabel,
  onConvertRule,
  compact = false,
}: {
  title: string;
  rules: HeaderRule[];
  searchQuery: string;
  onChange: (rules: HeaderRule[]) => void;
  focusRuleId?: string | null;
  convertLabel?: string;
  onConvertRule?: (rule: HeaderRule) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
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

  return (
    <section>
      <SectionHeader
        title={title}
        count={rules.length}
        open={open}
        enabled={enabled}
        onToggle={() => setOpen((current) => !current)}
        onToggleEnabled={() => onChange(rules.map((rule) => ({ ...rule, enabled: !enabled })))}
        onAdd={() => {
          const nextRule = createHeaderRule();
          setLocalFocusRuleId(nextRule.id);
          onChange([...rules, nextRule]);
          setOpen(true);
        }}
        onClear={() => onChange([])}
      />
      {open && (
        <div className={clsx(compact ? "space-y-1.5" : "space-y-2")}>
          {visibleRules.map((rule) => (
            <HeaderRuleRow
              key={rule.id}
              rule={rule}
              autoFocus={rule.id === focusRuleId || rule.id === localFocusRuleId}
              onChange={(patch) =>
                onChange(rules.map((item) => (item.id === rule.id ? { ...item, ...patch } : item)))
              }
              onDelete={() => onChange(rules.filter((item) => item.id !== rule.id))}
              onClone={() => {
                const clone = { ...rule, id: createHeaderRule().id };
                setLocalFocusRuleId(clone.id);
                onChange([...rules, clone]);
                setOpen(true);
              }}
              convertLabel={convertLabel}
              onConvert={onConvertRule ? () => onConvertRule(rule) : undefined}
              compact={compact}
            />
          ))}
          {!compact && rules.length === 0 && <EmptyState label={t("section.noRules", { title })} />}
          {rules.length > 0 && visibleRules.length === 0 && (
            <EmptyState label={t("section.noMatchedRules")} />
          )}
        </div>
      )}
    </section>
  );
}
