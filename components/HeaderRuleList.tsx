import React from "react";
import { Plus } from "lucide-react";
import type { HeaderRule } from "../types";
import { createHeaderRule } from "../types";
import { HeaderRuleRow } from "./HeaderRuleRow";
import { Button } from "./ui/button";

interface HeaderRuleListProps {
  title: string;
  rules: HeaderRule[];
  onChange: (rules: HeaderRule[]) => void;
}

export function HeaderRuleList({ title, rules, onChange }: HeaderRuleListProps) {
  const updateRule = (index: number, patch: Partial<HeaderRule>) => {
    onChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const deleteRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  const addRule = () => {
    onChange([...rules, createHeaderRule()]);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
          {title}
        </h3>
        <Button size="sm" variant="ghost" onClick={addRule} className="h-6 gap-1 text-xs">
          <Plus className="h-3 w-3" />
          Add
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))] py-2 text-center">
          No rules. Click Add to create one.
        </p>
      ) : (
        <div className="space-y-0.5">
          {rules.map((rule, index) => (
            <HeaderRuleRow
              key={rule.id}
              rule={rule}
              onChange={(patch) => updateRule(index, patch)}
              onDelete={() => deleteRule(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
