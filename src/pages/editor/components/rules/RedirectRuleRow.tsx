import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { clsx } from "clsx";
import { MessageSquarePlus, MessageSquareX, MoreHorizontal, X } from "lucide-react";
import { memo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../../../../components/ui/input";
import { Switch } from "../../../../components/ui/switch";
import type { NameValueRule } from "../../../../types/profile/profile-model";
import { menuItemClass } from "../shared/styles";

function RedirectRuleRowComponent({
  replacement,
  onChange,
  onDelete,
}: {
  replacement: NameValueRule;
  onChange: (ruleId: string, patch: Partial<NameValueRule>) => void;
  onDelete: (ruleId: string) => void;
}) {
  const { t } = useTranslation();
  const [showComment, setShowComment] = useState(Boolean(replacement.comment));
  const commentRef = useRef<HTMLInputElement>(null);
  const commentVisible = showComment || Boolean(replacement.comment);

  return (
    <div
      className={clsx(
        "rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm",
        !replacement.enabled && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
        <Switch
          checked={replacement.enabled}
          onCheckedChange={(enabled) => onChange(replacement.id, { enabled })}
          aria-label={t("redirect.enable")}
        />
        <input
          aria-label={t("redirect.pattern")}
          className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs font-normal outline-none focus:ring-2 focus:ring-[var(--theme-color)]"
          placeholder={t("redirect.patternPlaceholder")}
          value={replacement.name}
          onChange={(event) => onChange(replacement.id, { name: event.target.value })}
        />
        <span className="text-slate-400">→</span>
        <input
          aria-label={t("redirect.target")}
          className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs font-normal outline-none focus:ring-2 focus:ring-[var(--theme-color)]"
          placeholder={t("redirect.targetPlaceholder")}
          value={replacement.value}
          onChange={(event) => onChange(replacement.id, { value: event.target.value })}
        />
        <button
          type="button"
          aria-label={t("redirect.delete")}
          onClick={() => onDelete(replacement.id)}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={t("common.more")}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-[100] min-w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
            >
              <DropdownMenu.Group>
                <DropdownMenu.Item
                  className={menuItemClass}
                  onSelect={() => {
                    if (commentVisible) {
                      setShowComment(false);
                      onChange(replacement.id, { comment: "" });
                      return;
                    }
                    setShowComment(true);
                    window.setTimeout(() => commentRef.current?.focus(), 0);
                  }}
                >
                  {commentVisible ? (
                    <MessageSquareX aria-hidden="true" className="h-3.5 w-3.5" />
                  ) : (
                    <MessageSquarePlus aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                  {t(commentVisible ? "common.removeComment" : "common.addComment")}
                </DropdownMenu.Item>
              </DropdownMenu.Group>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      {commentVisible && (
        <div className="mt-2 pl-0 sm:pl-10">
          <Input
            ref={commentRef}
            aria-label={t("common.comment")}
            className="h-8 border-dashed border-slate-200 bg-transparent text-xs font-normal text-slate-500 shadow-none"
            placeholder={t("common.commentPlaceholder")}
            value={replacement.comment}
            onChange={(event) => {
              setShowComment(true);
              onChange(replacement.id, { comment: event.target.value });
            }}
          />
        </div>
      )}
    </div>
  );
}

export const RedirectRuleRow = memo(RedirectRuleRowComponent);
