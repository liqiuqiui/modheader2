import type { RefObject } from "react";
import { FileUp, Maximize2, Pause, Play, Plus, Redo2, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Profile } from "../../../types";
import { LanguageMenu } from "./LanguageMenu";
import { ProfileMenu } from "./ProfileMenu";
import { iconButtonClass } from "./styles";

export function EditorToolbar({
  profile,
  profileNumber,
  titleDraft,
  titleRef,
  locale,
  canUndo,
  canRedo,
  onTitleDraftChange,
  onTitleCommit,
  onUndo,
  onRedo,
  onAddProfile,
  onTogglePause,
  onExport,
  onOpenOptions,
  onLanguageChange,
  onRequestRename,
  onClone,
  onPickColor,
  onCopy,
  onDelete,
  onProfileMenuCloseAutoFocus,
}: {
  profile: Profile;
  profileNumber: number;
  titleDraft: string;
  titleRef: RefObject<HTMLInputElement | null>;
  locale: "en" | "zh-CN";
  canUndo: boolean;
  canRedo: boolean;
  onTitleDraftChange: (title: string) => void;
  onTitleCommit: (title: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddProfile: () => void;
  onTogglePause: () => void;
  onExport: () => void;
  onOpenOptions: () => void;
  onLanguageChange: (locale: "en" | "zh-CN") => void;
  onRequestRename: () => void;
  onClone: () => void;
  onPickColor: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onProfileMenuCloseAutoFocus: (event: Event) => void;
}) {
  const { t } = useTranslation();
  return (
    <header
      className="flex h-14 shrink-0 items-center gap-2 px-4 shadow-sm"
      style={{ backgroundColor: profile.backgroundColor, color: profile.textColor }}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/40 text-xs font-semibold">
        {profileNumber}
      </span>
      <input
        ref={titleRef}
        value={titleDraft}
        onChange={(event) => onTitleDraftChange(event.target.value)}
        onBlur={(event) => onTitleCommit(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        aria-label={t("profile.name")}
        className="h-8 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-3 text-sm font-bold outline-none transition-[background-color,border-color,box-shadow] duration-200 ease-out placeholder:text-current/60 hover:border-white/10 hover:bg-white/15 focus:border-white/30 focus:bg-white/20 focus:ring-2 focus:ring-white/20"
      />
      {profile.paused && (
        <span className="rounded-md border border-white/25 bg-white/15 px-2 py-1 text-[10px] font-bold tracking-[0.08em]">
          {t("toolbar.pausedBadge")}
        </span>
      )}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          title={t("toolbar.undo")}
          aria-label={t("toolbar.undo")}
          disabled={!canUndo}
          onClick={onUndo}
          className={iconButtonClass(!canUndo)}
        >
          <Undo2 aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={t("toolbar.redo")}
          aria-label={t("toolbar.redo")}
          disabled={!canRedo}
          onClick={onRedo}
          className={iconButtonClass(!canRedo)}
        >
          <Redo2 aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={t("toolbar.newProfile")}
          aria-label={t("toolbar.newProfile")}
          onClick={onAddProfile}
          className={iconButtonClass()}
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={profile.paused ? t("toolbar.resume") : t("toolbar.pause")}
          aria-label={profile.paused ? t("toolbar.resume") : t("toolbar.pause")}
          onClick={onTogglePause}
          className={iconButtonClass()}
        >
          {profile.paused ? (
            <Play aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Pause aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          title={t("profile.export")}
          aria-label={t("profile.export")}
          onClick={onExport}
          className={iconButtonClass()}
        >
          <FileUp aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={t("toolbar.expand")}
          aria-label={t("toolbar.expand")}
          onClick={onOpenOptions}
          className={iconButtonClass()}
        >
          <Maximize2 aria-hidden="true" className="h-4 w-4" />
        </button>
        <LanguageMenu locale={locale} onLanguageChange={onLanguageChange} />
        <ProfileMenu
          onRename={onRequestRename}
          onClone={onClone}
          onPickColor={onPickColor}
          onExport={onExport}
          onCopy={onCopy}
          onDelete={onDelete}
          onCloseAutoFocus={onProfileMenuCloseAutoFocus}
        />
      </div>
    </header>
  );
}
