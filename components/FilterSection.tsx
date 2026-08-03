import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { UrlFilter, UrlReplacement } from "../types";
import { createUrlFilter, createUrlReplacement } from "../types";
import { Switch } from "./ui/switch";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

// ─── URL Filters ──────────────────────────────────────────────────────────

interface UrlFilterListProps {
  title: string;
  filters: UrlFilter[];
  onChange: (filters: UrlFilter[]) => void;
}

function UrlFilterRow({
  filter,
  onChange,
  onDelete,
}: {
  filter: UrlFilter;
  onChange: (patch: Partial<UrlFilter>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-1.5 py-1">
      <Switch
        checked={filter.enabled}
        onCheckedChange={(checked) => onChange({ enabled: checked })}
        className="flex-shrink-0"
      />
      <Input
        className="flex-1 font-mono text-xs"
        placeholder="URL regex (e.g. .*://example\.com/.*)"
        value={filter.urlRegex}
        onChange={(e) => onChange({ urlRegex: e.target.value })}
      />
      <button
        className="flex-shrink-0 p-1 rounded hover:bg-red-50 text-[hsl(var(--muted-foreground))] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function UrlFilterSection({ title, filters, onChange }: UrlFilterListProps) {
  const update = (index: number, patch: Partial<UrlFilter>) => {
    onChange(filters.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };
  const remove = (index: number) => onChange(filters.filter((_, i) => i !== index));
  const add = () => onChange([...filters, createUrlFilter()]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
          {title}
        </h3>
        <Button size="sm" variant="ghost" onClick={add} className="h-6 gap-1 text-xs">
          <Plus className="h-3 w-3" />
          Add
        </Button>
      </div>
      {filters.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))] py-1 text-center">
          No filters — rules apply to all URLs
        </p>
      ) : (
        filters.map((f, i) => (
          <UrlFilterRow
            key={f.id}
            filter={f}
            onChange={(p) => update(i, p)}
            onDelete={() => remove(i)}
          />
        ))
      )}
    </div>
  );
}

// ─── URL Replacements ─────────────────────────────────────────────────────

interface UrlReplacementListProps {
  replacements: UrlReplacement[];
  onChange: (replacements: UrlReplacement[]) => void;
}

function UrlReplacementRow({
  replacement,
  onChange,
  onDelete,
}: {
  replacement: UrlReplacement;
  onChange: (patch: Partial<UrlReplacement>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-1.5 py-1">
      <Switch
        checked={replacement.enabled}
        onCheckedChange={(checked) => onChange({ enabled: checked })}
        className="flex-shrink-0"
      />
      <Input
        className="flex-1 font-mono text-xs"
        placeholder="Regex pattern"
        value={replacement.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <span className="text-[hsl(var(--muted-foreground))] text-xs flex-shrink-0">→</span>
      <Input
        className="flex-1 font-mono text-xs"
        placeholder="Replacement ($1, $2...)"
        value={replacement.value}
        onChange={(e) => onChange({ value: e.target.value })}
      />
      <button
        className="flex-shrink-0 p-1 rounded hover:bg-red-50 text-[hsl(var(--muted-foreground))] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function UrlReplacementSection({ replacements, onChange }: UrlReplacementListProps) {
  const update = (index: number, patch: Partial<UrlReplacement>) => {
    onChange(replacements.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };
  const remove = (index: number) => onChange(replacements.filter((_, i) => i !== index));
  const add = () => onChange([...replacements, createUrlReplacement()]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
          URL Replacements
        </h3>
        <Button size="sm" variant="ghost" onClick={add} className="h-6 gap-1 text-xs">
          <Plus className="h-3 w-3" />
          Add
        </Button>
      </div>
      {replacements.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))] py-1 text-center">
          No URL replacements
        </p>
      ) : (
        replacements.map((r, i) => (
          <UrlReplacementRow
            key={r.id}
            replacement={r}
            onChange={(p) => update(i, p)}
            onDelete={() => remove(i)}
          />
        ))
      )}
    </div>
  );
}
