import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { FileUp, Maximize2, Pause, Play, Plus, Redo2, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useProfileStore } from "../../../modules/profile/state/profile-store";
import { useEditorUiStore } from "../stores/editor-ui-store";
import { LanguageMenu } from "./LanguageMenu";
import { ProfileMenu } from "./ProfileMenu";
import { iconButtonClass } from "./styles";

export function EditorToolbar({
  titleRef,
  locale,
  onExport,
  onOpenOptions,
  onLanguageChange,
  onRequestRename,
  onPickColor,
  onCopy,
  onDelete,
  onProfileMenuCloseAutoFocus,
}: {
  titleRef: RefObject<HTMLInputElement | null>;
  locale: "en" | "zh-CN";
  onExport: () => void;
  onOpenOptions: () => void;
  onLanguageChange: (locale: "en" | "zh-CN") => void;
  onRequestRename: () => void;
  onPickColor: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onProfileMenuCloseAutoFocus: (event: Event) => void;
}) {
  const { t } = useTranslation();
  const profile = useProfileStore(
    useShallow((state) => {
      const selected = state.selectedProfileId
        ? state.profilesById[state.selectedProfileId]
        : undefined;
      if (!selected) return null;
      return {
        id: selected.id,
        title: selected.title,
        backgroundColor: selected.backgroundColor,
        textColor: selected.textColor,
        paused: selected.paused,
      };
    }),
  );
  const profileNumber = useProfileStore((state) =>
    state.selectedProfileId ? state.profileOrder.indexOf(state.selectedProfileId) + 1 : 0,
  );
  const canUndo = useProfileStore((state) => state.past.length > 0);
  const canRedo = useProfileStore((state) => state.future.length > 0);
  const patchProfile = useProfileStore((state) => state.patchProfile);
  const undo = useProfileStore((state) => state.undo);
  const redo = useProfileStore((state) => state.redo);
  const addProfile = useProfileStore((state) => state.addProfile);
  const cloneProfile = useProfileStore((state) => state.cloneProfile);
  const showNotice = useEditorUiStore((state) => state.showNotice);
  const [titleDraft, setTitleDraft] = useState(profile?.title ?? "");

  useEffect(() => {
    setTitleDraft(profile?.title ?? "");
  }, [profile?.id, profile?.title]);

  if (!profile) return null;

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
        onChange={(event) => setTitleDraft(event.target.value)}
        onBlur={(event) => {
          const title = event.currentTarget.value;
          if (title !== profile.title) void patchProfile(profile.id, { title });
        }}
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
          onClick={() => void undo()}
          className={iconButtonClass(!canUndo)}
        >
          <Undo2 aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={t("toolbar.redo")}
          aria-label={t("toolbar.redo")}
          disabled={!canRedo}
          onClick={() => void redo()}
          className={iconButtonClass(!canRedo)}
        >
          <Redo2 aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={t("toolbar.newProfile")}
          aria-label={t("toolbar.newProfile")}
          onClick={() => void addProfile(locale)}
          className={iconButtonClass()}
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={profile.paused ? t("toolbar.resume") : t("toolbar.pause")}
          aria-label={profile.paused ? t("toolbar.resume") : t("toolbar.pause")}
          onClick={() => void patchProfile(profile.id, { paused: !profile.paused })}
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
          onClone={() => {
            void cloneProfile(profile.id, locale).then((saved) => {
              if (saved) showNotice(t("profile.cloned"));
            });
          }}
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
