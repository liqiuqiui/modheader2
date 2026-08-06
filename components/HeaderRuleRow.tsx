import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { clsx } from "clsx";
import {
  ArrowRightLeft,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  MessageSquarePlus,
  MessageSquareX,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import type { AppendMode, HeaderRule } from "../modules/profile/domain/profile-model";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "./ui/combobox";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";
import { useTranslation } from "react-i18next";

const EMPTY_NAME_SUGGESTIONS: readonly string[] = [];

interface HeaderRuleRowProps {
  rule: HeaderRule;
  onChange: (ruleId: string, patch: Partial<HeaderRule>) => void;
  onDelete: (ruleId: string) => void;
  onClone?: (ruleId: string) => void;
  onConvert?: (ruleId: string) => void;
  convertLabel?: string;
  autoFocus?: boolean;
  searchQuery?: string;
  compact?: boolean;
  nameSuggestions?: readonly string[];
}

function isSensitiveHeader(name: string) {
  return /authorization|cookie|set-cookie|token|secret|password|api[-_]?key/i.test(name);
}

function HeaderRuleRowComponent({
  rule,
  onChange,
  onDelete,
  onClone,
  onConvert,
  convertLabel,
  autoFocus,
  compact = false,
  nameSuggestions = EMPTY_NAME_SUGGESTIONS,
}: HeaderRuleRowProps) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const [showComment, setShowComment] = useState(Boolean(rule.comment));
  const commentRef = useRef<HTMLInputElement>(null);
  const sensitive = useMemo(() => isSensitiveHeader(rule.name), [rule.name]);
  const selectedNameSuggestion = useMemo(() => {
    const normalizedName = rule.name.trim().toLowerCase();
    if (!normalizedName) return null;
    return (
      nameSuggestions.find((suggestion) => suggestion.toLowerCase() === normalizedName) ?? null
    );
  }, [nameSuggestions, rule.name]);

  useEffect(() => {
    if (rule.comment) setShowComment(true);
  }, [rule.comment]);
  const appendModes: { value: AppendMode; label: string }[] = [
    { value: "override", label: t("header.override") },
    { value: "append", label: t("header.append") },
    { value: "comma", label: t("header.comma") },
  ];

  return (
    <div
      className={clsx(
        "group rounded-lg border bg-white transition",
        compact ? "p-1.5 shadow-sm" : "p-2.5 shadow-sm",
        rule.enabled ? "border-slate-200" : "border-slate-200/70 opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
        {!compact && (
          <GripVertical
            aria-hidden="true"
            className="hidden h-4 w-4 shrink-0 cursor-grab text-slate-300 sm:block"
          />
        )}
        <Switch
          checked={rule.enabled}
          onCheckedChange={(enabled) => onChange(rule.id, { enabled })}
          aria-label={`${rule.name || "Header"} ${rule.enabled ? t("common.enabled") : t("common.disabled")}`}
          className="shrink-0"
        />
        <Combobox
          items={nameSuggestions}
          value={selectedNameSuggestion}
          inputValue={rule.name}
          autoComplete="off"
          autoHighlight
          onInputValueChange={(name, eventDetails) => {
            if (eventDetails.reason === "input-change") onChange(rule.id, { name });
          }}
          onValueChange={(name) => {
            if (name !== null) onChange(rule.id, { name });
          }}
        >
          <ComboboxInput
            aria-label={t("header.name")}
            className="h-8 min-w-0 flex-[0.85] border-slate-200 bg-slate-50 shadow-none focus-within:bg-white [&_[data-slot=input-group-control]]:font-mono"
            placeholder={t("header.namePlaceholder")}
            autoFocus={autoFocus && !rule.name}
            spellCheck={false}
          />
          <ComboboxContent sideOffset={4}>
            <ComboboxEmpty className="px-3 text-left text-[11px] leading-4">
              {t("header.noNameSuggestions")}
            </ComboboxEmpty>
            <ComboboxList className="max-h-60">
              {(name) => (
                <ComboboxItem key={name} value={name} className="py-2 font-mono text-xs">
                  <span className="truncate" title={name}>
                    {name}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <div className="relative min-w-0 flex-[1.4]">
          <Input
            aria-label={t("header.value")}
            type={sensitive && !revealed ? "password" : "text"}
            className="h-8 border-slate-200 bg-slate-50 pr-9 font-mono text-xs font-normal shadow-none focus-visible:bg-white"
            placeholder={t("header.valuePlaceholder")}
            value={rule.value}
            autoFocus={autoFocus && Boolean(rule.name)}
            onChange={(event) => onChange(rule.id, { value: event.target.value })}
            spellCheck={false}
          />
          {sensitive && (
            <button
              type="button"
              aria-label={revealed ? t("header.hideValue") : t("header.showValue")}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              onClick={() => setRevealed((current) => !current)}
            >
              {revealed ? (
                <EyeOff aria-hidden="true" className="h-3.5 w-3.5" />
              ) : (
                <Eye aria-hidden="true" className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
        {!compact && (
          <Select
            value={rule.appendMode}
            onValueChange={(appendMode) =>
              onChange(rule.id, { appendMode: appendMode as AppendMode })
            }
          >
            <SelectTrigger
              aria-label={t("header.mode")}
              className="h-8 shrink-0 border-slate-200 bg-slate-50 text-xs font-normal text-slate-600 shadow-none hover:bg-white"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {appendModes.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        <button
          type="button"
          aria-label={t("header.delete")}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
          onClick={() => onDelete(rule.id)}
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
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-[100] min-w-44 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl"
            >
              <DropdownMenu.Item
                className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs outline-none transition hover:bg-slate-100 focus:bg-slate-100"
                onSelect={() => {
                  if (showComment) {
                    setShowComment(false);
                    onChange(rule.id, { comment: "" });
                    return;
                  }
                  setShowComment(true);
                  window.setTimeout(() => commentRef.current?.focus(), 0);
                }}
              >
                {showComment ? (
                  <MessageSquareX aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <MessageSquarePlus aria-hidden="true" className="h-3.5 w-3.5" />
                )}{" "}
                {t(showComment ? "header.removeComment" : "header.addComment")}
              </DropdownMenu.Item>
              {onClone && (
                <DropdownMenu.Item
                  className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs outline-none transition hover:bg-slate-100 focus:bg-slate-100"
                  onSelect={() => onClone?.(rule.id)}
                >
                  <Copy aria-hidden="true" className="h-3.5 w-3.5" /> {t("header.clone")}
                </DropdownMenu.Item>
              )}
              {onConvert && convertLabel && (
                <DropdownMenu.Item
                  className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs outline-none transition hover:bg-slate-100 focus:bg-slate-100"
                  onSelect={() => onConvert?.(rule.id)}
                >
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
            className="h-8 border-dashed border-slate-200 bg-transparent text-xs font-normal text-slate-500 shadow-none"
            placeholder={t("header.commentPlaceholder")}
            value={rule.comment}
            onChange={(event) => onChange(rule.id, { comment: event.target.value })}
          />
        </div>
      )}
    </div>
  );
}

export const HeaderRuleRow = memo(HeaderRuleRowComponent);
