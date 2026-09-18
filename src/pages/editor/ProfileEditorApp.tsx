import type { CSSProperties } from "react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { ThemePortalProvider } from "../../components/ThemePortalProvider";
import { EditorInputs } from "./components/shared/EditorInputs";
import { EditorSections } from "./components/layout/EditorSections";
import { EditorToolbar } from "./components/layout/EditorToolbar";
import { NoticeToast } from "./components/layout/NoticeToast";
import { ProfileStatusCard } from "./components/layout/ProfileStatusCard";
import { QuickAddActions } from "./components/layout/QuickAddActions";
import { Sidebar } from "./components/layout/Sidebar";
import { appStore } from "../../store/app-store";

import { useEditorRuntime } from "./editor-runtime";
import { useEditorController } from "./editor-controller";
import type { EditorMode } from "./types";
import {
  copyProfileJson,
  exportProfileFile,
  parseImportedProfiles,
} from "./actions/profile-transfer-actions";
import { closePopup, openOptionsPage } from "./browser/runtime-service";

export function ProfileEditorApp({ mode = "options" }: { mode?: EditorMode } = {}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "en" ? "en" : "zh-CN";
  const controller = useEditorController();
  const { profile, actions, status, error, notice, canUndo: _canUndo } = controller;
  const { titleRef, renameRequestedRef, fileInputRef, colorInputRef, colorTargetProfileIdRef } =
    useEditorRuntime(locale, mode);
  const showNotice = (message: string) => appStore.getState().showNotice(message);
  const currentProfile = () => profile;
  const hasProfile = Boolean(profile);
  const themeColor = profile?.backgroundColor;
  const profilePaused = profile?.paused ?? false;

  const requestTitleRename = () => {
    renameRequestedRef.current = true;
  };

  const handlePickColor = () => {
    const profile = currentProfile();
    const input = colorInputRef.current;
    if (!profile || !input) return;

    colorTargetProfileIdRef.current = profile.id;
    input.value = profile.backgroundColor;
    window.setTimeout(() => input.click(), 0);
  };

  const handleColorChange = (backgroundColor: string) => {
    const profileId = colorTargetProfileIdRef.current;
    if (!profileId) return;
    void actions.patchProfile(profileId, { backgroundColor });
  };

  const handleProfileMenuCloseAutoFocus = (event: Event) => {
    if (!renameRequestedRef.current) return;
    event.preventDefault();
    renameRequestedRef.current = false;
    window.requestAnimationFrame(() => {
      const input = titleRef.current;
      if (!input) return;
      input.focus();
      input.select();
    });
  };

  const exportProfile = () => {
    const profile = currentProfile();
    if (!profile) return;
    exportProfileFile(profile);
    showNotice(t("profile.exported"));
  };

  const copyProfile = async () => {
    const profile = currentProfile();
    if (!profile) return;
    await copyProfileJson(profile);
    showNotice(t("profile.copied"));
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const profiles = parseImportedProfiles(JSON.parse(await file.text()));
      if (!profiles) throw new Error(t("import.invalid"));
      if (profiles.length === 0) throw new Error(t("import.empty"));
      const count = await actions.importProfiles(profiles);
      if (count === 0) {
        throw new Error(controller.error ?? t("import.invalid"));
      }
      showNotice(t("import.success", { count }));
    } catch (importError) {
      window.alert(
        t("import.failed", {
          message: importError instanceof Error ? importError.message : t("import.invalid"),
        }),
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    const profile = currentProfile();
    if (!profile || !window.confirm(t("profile.deleteConfirm", { title: profile.title }))) return;
    await actions.deleteProfile(profile.id, locale);
  };

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
        {t("common.loading")}
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 px-6 text-center text-sm text-rose-600">
        {error ?? t("import.invalid")}
      </div>
    );
  }
  if (!hasProfile || !themeColor) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
        {t("profile.none")}
      </div>
    );
  }

  return (
    <ThemePortalProvider themeColor={themeColor}>
      <div
        className={clsx(
          "flex overflow-hidden bg-slate-100 text-slate-800",
          mode === "popup" ? "h-[580px] w-[780px]" : "h-screen w-full",
        )}
        style={{ "--theme-color": themeColor } as CSSProperties}
      >
        <Sidebar mode={mode} onImport={() => fileInputRef.current?.click()} />

        <main
          className={clsx(
            "flex min-h-0 min-w-0 flex-1 flex-col transition-[filter,opacity] duration-200",
            profilePaused && "grayscale opacity-70",
          )}
        >
          <EditorToolbar
            titleRef={titleRef}
            locale={locale}
            onExport={exportProfile}
            onOpenOptions={() => {
              void openOptionsPage();
              closePopup();
            }}
            onLanguageChange={(nextLocale) => void i18n.changeLanguage(nextLocale)}
            onRequestRename={requestTitleRename}
            onPickColor={handlePickColor}
            onCopy={() => void copyProfile()}
            onDelete={() => void handleDelete()}
            onProfileMenuCloseAutoFocus={handleProfileMenuCloseAutoFocus}
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div
              className={clsx(
                "mx-auto w-full max-w-6xl",
                mode === "popup" ? "px-4 py-4" : "px-4 py-5 sm:px-6",
              )}
            >
              {mode !== "popup" && <ProfileStatusCard />}
              <EditorSections mode={mode} />
            </div>
          </div>

          <div className="shrink-0 bg-slate-100">
            <div
              className={clsx(
                "mx-auto w-full max-w-6xl",
                mode === "popup" ? "px-4 pb-4 pt-3" : "px-4 pb-5 pt-3 sm:px-6",
              )}
            >
              <QuickAddActions />
            </div>
          </div>
        </main>

        <EditorInputs
          fileInputRef={fileInputRef}
          colorInputRef={colorInputRef}
          onImport={(file) => void handleImport(file)}
          onColorChange={handleColorChange}
        />
        <NoticeToast message={error ?? notice} />
      </div>
    </ThemePortalProvider>
  );
}
