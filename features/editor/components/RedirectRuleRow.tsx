import { clsx } from "clsx";
import { X } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "../../../components/ui/switch";
import type { NameValueRule } from "../../../modules/profile/domain/profile-model";

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
  return (
    <div
      className={clsx(
        "flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm",
        !replacement.enabled && "opacity-60",
      )}
    >
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
    </div>
  );
}

export const RedirectRuleRow = memo(RedirectRuleRowComponent);
