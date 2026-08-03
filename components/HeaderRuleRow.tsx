import React, { useEffect, useMemo, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowRightLeft, Copy, Eye, EyeOff, GripVertical, MessageSquarePlus, MoreHorizontal, Trash2 } from "lucide-react";
import type { HeaderRule, AppendMode } from "../types";
import { Switch } from "./ui/switch";
import { Input } from "./ui/input";
import { useTranslation } from "react-i18next";

interface HeaderRuleRowProps {
  rule: HeaderRule;
  onChange: (patch: Partial<HeaderRule>) => void;
  onDelete: () => void;
  onClone?: () => void;
  onConvert?: () => void;
  convertLabel?: string;
  autoFocus?: boolean;
  searchQuery?: string;
  compact?: boolean;
}

function isSensitiveHeader(name: string) {
  return /authorization|cookie|set-cookie|token|secret|password|api[-_]?key/i.test(name);
}

export function HeaderRuleRow({ rule, onChange, onDelete, onClone, onConvert, convertLabel, autoFocus, compact = false }: HeaderRuleRowProps) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const [showComment, setShowComment] = useState(Boolean(rule.comment));
  const commentRef = useRef<HTMLInputElement>(null);
  const sensitive = useMemo(() => isSensitiveHeader(rule.name), [rule.name]);

  useEffect(() => {
    if (rule.comment) setShowComment(true);
  }, [rule.comment]);
  const appendModes: { value: AppendMode; label: string }[] = [
    { value: "override", label: t("header.override") },
    { value: "append", label: t("header.append") },
    { value: "comma", label: t("header.comma") },
  ];

  return (
    <div className={`group rounded-lg border bg-white ${compact ? "p-1.5 shadow-sm" : "p-2.5 shadow-sm"} transition ${rule.enabled ? "border-slate-200" : "border-slate-200/70 opacity-60"}`}>
      <div className="flex items-center gap-2">
        {!compact && <GripVertical aria-hidden="true" className="hidden h-4 w-4 shrink-0 cursor-grab text-slate-300 sm:block" />}
        <Switch
          checked={rule.enabled}
          onCheckedChange={(enabled) => onChange({ enabled })}
          aria-label={`${rule.name || "Header"} ${rule.enabled ? t("common.enabled") : t("common.disabled")}`}
          className="shrink-0"
        />
        <Input
          aria-label={t("header.name")}
          className={`${compact ? "h-8" : "h-9"} min-w-0 flex-[0.85] border-slate-200 bg-slate-50 font-mono text-xs font-semibold shadow-none focus-visible:bg-white`}
          placeholder={t("header.namePlaceholder")}
          value={rule.name}
          autoFocus={autoFocus && !rule.name}
          onChange={(event) => onChange({ name: event.target.value })}
          spellCheck={false}
        />
        <div className="relative min-w-0 flex-[1.4]">
          <Input
            aria-label={t("header.value")}
            type={sensitive && !revealed ? "password" : "text"}
            className={`${compact ? "h-8" : "h-9"} border-slate-200 bg-slate-50 pr-9 font-mono text-xs shadow-none focus-visible:bg-white`}
            placeholder={t("header.valuePlaceholder")}
            value={rule.value}
            autoFocus={autoFocus && Boolean(rule.name)}
            onChange={(event) => onChange({ value: event.target.value })}
            spellCheck={false}
          />
          {sensitive && (
            <button
              type="button"
              aria-label={revealed ? t("header.hideValue") : t("header.showValue")}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              onClick={() => setRevealed((current) => !current)}
            >
              {revealed ? <EyeOff aria-hidden="true" className="h-3.5 w-3.5" /> : <Eye aria-hidden="true" className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        {!compact && (
          <select
            aria-label={t("header.mode")}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-600 outline-none transition hover:bg-white focus:ring-2 focus:ring-[var(--theme-color)]"
            value={rule.appendMode}
            onChange={(event) => onChange({ appendMode: event.target.value as AppendMode })}
          >
            {appendModes.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          aria-label={t("header.delete")}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
          onClick={onDelete}
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={t("header.more")}
              title={t("header.more")}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="z-[100] min-w-44 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl">
              <DropdownMenu.Item
                className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs outline-none transition hover:bg-slate-100 focus:bg-slate-100"
                onSelect={() => {
                  setShowComment(true);
                  window.setTimeout(() => commentRef.current?.focus(), 0);
                }}
              >
                <MessageSquarePlus aria-hidden="true" className="h-3.5 w-3.5" /> {t("header.addComment")}
              </DropdownMenu.Item>
              {onClone && (
                <DropdownMenu.Item className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs outline-none transition hover:bg-slate-100 focus:bg-slate-100" onSelect={onClone}>
                  <Copy aria-hidden="true" className="h-3.5 w-3.5" /> {t("header.clone")}
                </DropdownMenu.Item>
              )}
              {onConvert && convertLabel && (
                <DropdownMenu.Item className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs outline-none transition hover:bg-slate-100 focus:bg-slate-100" onSelect={onConvert}>
                  <ArrowRightLeft aria-hidden="true" className="h-3.5 w-3.5" /> {convertLabel}
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      {showComment && (
        <div className="mt-2 pl-0 sm:pl-10">
          <Input
            ref={commentRef}
            aria-label={t("header.comment")}
            className="h-7 border-dashed border-slate-200 bg-transparent text-xs text-slate-500 shadow-none"
            placeholder={t("header.commentPlaceholder")}
            value={rule.comment}
            onChange={(event) => onChange({ comment: event.target.value })}
          />
        </div>
      )}
    </div>
  );
}
