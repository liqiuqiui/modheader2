import { clsx } from "clsx";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Switch } from "../../../components/ui/switch";
import type { UrlReplacement } from "../../../modules/profile/domain/profile-model";

export function RedirectRuleRow({
  replacement,
  onChange,
  onDelete,
}: {
  replacement: UrlReplacement;
  onChange: (patch: Partial<UrlReplacement>) => void;
  onDelete: () => void;
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
        onCheckedChange={(enabled) => onChange({ enabled })}
        aria-label={t("redirect.enable")}
      />
      <input
        aria-label={t("redirect.pattern")}
        className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-[var(--theme-color)]"
        placeholder={t("redirect.patternPlaceholder")}
        value={replacement.name}
        onChange={(event) => onChange({ name: event.target.value })}
      />
      <span className="text-slate-400">→</span>
      <input
        aria-label={t("redirect.target")}
        className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-[var(--theme-color)]"
        placeholder={t("redirect.targetPlaceholder")}
        value={replacement.value}
        onChange={(event) => onChange({ value: event.target.value })}
      />
      <button
        type="button"
        aria-label={t("redirect.delete")}
        onClick={onDelete}
        className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
