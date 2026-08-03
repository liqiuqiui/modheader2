import { useTranslation } from "react-i18next";
import { Switch } from "../../../components/ui/switch";
import type { Profile } from "../../../types";
import { profileFilters } from "../filterModel";

export function ProfileStatusCard({
  profile,
  onEnabledChange,
}: {
  profile: Profile;
  onEnabledChange: (enabled: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <Switch
        checked={profile.enabled}
        onCheckedChange={onEnabledChange}
        aria-label={profile.enabled ? t("common.enabled") : t("common.disabled")}
      />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-slate-700">
          {profile.enabled ? t("profile.enabled") : t("profile.disabled")}
        </div>
        <div className="mt-0.5 text-[11px] text-slate-400">{t("status.autoSave")}</div>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <span className="rounded-full bg-slate-100 px-2 py-1">
          {t("mod.count", {
            count:
              profile.headers.length +
              profile.respHeaders.length +
              profile.cookies.length +
              profile.urlReplacements.length,
          })}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1">
          {t("filter.count", { count: profileFilters(profile).length })}
        </span>
      </div>
    </div>
  );
}
