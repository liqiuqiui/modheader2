import { memo, useEffect, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { clsx } from "clsx";
import { Copy, MessageSquarePlus, MessageSquareX, MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CspRule } from "../../../modules/profile/domain/profile-model";
import { Input } from "../../../components/ui/input";
import { Switch } from "../../../components/ui/switch";

function CspRuleRowComponent({
  rule,
  onChange,
  onDelete,
  onClone,
  onFocusLeave,
  autoFocus,
  compact = false,
}: {
  rule: CspRule;
  onChange: (ruleId: string, patch: Partial<CspRule>) => void;
  onDelete: (ruleId: string) => void;
  onClone?: (ruleId: string) => void;
  onFocusLeave?: (ruleId: string) => void;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [showComment, setShowComment] = useState(Boolean(rule.comment));
  const commentRef = useRef<HTMLInputElement>(null);
  const directiveRef = useRef<HTMLInputElement>(null);
  const directiveValueRef = useRef<HTMLInputElement>(null);
  const autoFocusHandledRef = useRef(false);
  const directiveLabel = rule.directive || t("csp.unnamed");

  useEffect(() => {
    if (rule.comment) setShowComment(true);
  }, [rule.comment]);

  useEffect(() => {
    if (!autoFocus) {
      autoFocusHandledRef.current = false;
      return;
    }
    if (autoFocusHandledRef.current) return;
    autoFocusHandledRef.current = true;
    (rule.directive ? directiveValueRef : directiveRef).current?.focus();
  }, [autoFocus, rule.directive]);

  return (
    <div
      role="group"
      aria-label={t("csp.ruleLabel", { directive: directiveLabel })}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
        if (nextTarget instanceof HTMLElement && nextTarget.closest('[role="menu"]')) return;
        onFocusLeave?.(rule.id);
      }}
      className={clsx(
        "group rounded-lg border bg-white transition",
        compact ? "p-1.5 shadow-sm" : "p-2.5 shadow-sm",
        rule.enabled ? "border-slate-200" : "border-slate-200/70 opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
        <Switch
          checked={rule.enabled}
          onCheckedChange={(enabled) => onChange(rule.id, { enabled })}
          aria-label={t(rule.enabled ? "csp.disableRule" : "csp.enableRule", {
            directive: directiveLabel,
          })}
          className="shrink-0"
        />
        <Input
          ref={directiveRef}
          aria-label={t("csp.directive")}
          className="h-8 min-w-0 flex-[0.85] border-slate-200 bg-slate-50 font-mono text-xs font-normal shadow-none focus-visible:bg-white"
          placeholder={t("csp.directivePlaceholder")}
          value={rule.directive}
          onChange={(event) => onChange(rule.id, { directive: event.target.value })}
          spellCheck={false}
        />
        <Input
          ref={directiveValueRef}
          aria-label={t("csp.value")}
          className="h-8 min-w-0 flex-[1.4] border-slate-200 bg-slate-50 font-mono text-xs font-normal shadow-none focus-visible:bg-white"
          placeholder={t("csp.valuePlaceholder")}
          value={rule.value}
          onChange={(event) => onChange(rule.id, { value: event.target.value })}
          spellCheck={false}
        />
        <button
          type="button"
          aria-label={t("csp.deleteRule", { directive: directiveLabel })}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
          onClick={() => onDelete(rule.id)}
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={t("csp.moreRule", { directive: directiveLabel })}
              title={t("csp.moreRule", { directive: directiveLabel })}
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
                )}
                {t(showComment ? "csp.removeComment" : "csp.addComment")}
              </DropdownMenu.Item>
              {onClone && (
                <DropdownMenu.Item
                  className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs outline-none transition hover:bg-slate-100 focus:bg-slate-100"
                  onSelect={() => onClone?.(rule.id)}
                >
                  <Copy aria-hidden="true" className="h-3.5 w-3.5" /> {t("csp.clone")}
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
            aria-label={t("csp.comment")}
            className="h-8 border-dashed border-slate-200 bg-transparent text-xs font-normal text-slate-500 shadow-none"
            placeholder={t("csp.commentPlaceholder")}
            value={rule.comment}
            onChange={(event) => onChange(rule.id, { comment: event.target.value })}
          />
        </div>
      )}
    </div>
  );
}

export const CspRuleRow = memo(CspRuleRowComponent);
