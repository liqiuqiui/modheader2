import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { clsx } from "clsx";
import { browser } from "wxt/browser";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { ThemePortalProvider } from "../../components/ThemePortalProvider";
import {
  createProfileExportDocument,
  parseProfileExportDocument,
} from "../../modules/profile/application/profile-transfer";
import { selectSelectedProfile } from "../../modules/profile/state/profile-selectors";
import { profileStore, useProfileStore } from "../../modules/profile/state/profile-store";
import { EditorInputs } from "./components/EditorInputs";
import { EditorSections } from "./components/EditorSections";
import { EditorToolbar } from "./components/EditorToolbar";
import { NoticeToast } from "./components/NoticeToast";
import { ProfileStatusCard } from "./components/ProfileStatusCard";
import { QuickAddActions } from "./components/QuickAddActions";
import { Sidebar } from "./components/Sidebar";
import { connectBrowserTabs } from "./stores/browser-tabs-store";
import { editorUiStore, useEditorUiStore } from "./stores/editor-ui-store";
import type { EditorMode } from "./types";

function EditorNoticeToast() {
  const notice = useEditorUiStore((state) => state.notice);
  const saveError = useProfileStore((state) => (state.status === "ready" ? state.error : null));
  return <NoticeToast message={saveError ?? notice} />;
}

export function ProfileEditorApp({ mode = "options" }: { mode?: EditorMode } = {}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "en" ? "en" : "zh-CN";
  const { status, error, hasProfile, themeColor, profilePaused } = useProfileStore(
    useShallow((state) => {
      const selected = state.selectedProfileId
        ? state.profiles.find((profile) => profile.id === state.selectedProfileId)
        : undefined;
      return {
        status: state.status,
        error: state.error,
        hasProfile: Boolean(selected),
        themeColor: selected?.backgroundColor,
        profilePaused: selected?.paused ?? false,
      };
    }),
  );
  const titleRef = useRef<HTMLInputElement>(null);
  const renameRequestedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const colorTargetProfileIdRef = useRef<string | null>(null);

  useEffect(() => {
    editorUiStore.getState().initialize(mode);
    return connectBrowserTabs();
  }, [mode]);

  useEffect(() => {
    void profileStore.getState().initialize(locale);
  }, [locale]);

  const currentProfile = () => selectSelectedProfile(profileStore.getState());
  const showNotice = (message: string) => editorUiStore.getState().showNotice(message);

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
    void profileStore.getState().patchProfile(profileId, { backgroundColor });
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
    const blob = new Blob([JSON.stringify(createProfileExportDocument([profile]), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${profile.title.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "profile"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showNotice(t("profile.exported"));
  };

  const copyProfile = async () => {
    const profile = currentProfile();
    if (!profile) return;
    await navigator.clipboard.writeText(
      JSON.stringify(createProfileExportDocument([profile]), null, 2),
    );
    showNotice(t("profile.copied"));
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const profiles = parseProfileExportDocument(JSON.parse(await file.text()));
      if (!profiles) throw new Error(t("import.invalid"));
      if (profiles.length === 0) throw new Error(t("import.empty"));
      const count = await profileStore.getState().importProfiles(profiles);
      if (count === 0) {
        throw new Error(profileStore.getState().error ?? t("import.invalid"));
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
    await profileStore.getState().deleteProfile(profile.id, locale);
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
              void browser.runtime.openOptionsPage();
              window.close();
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
        <EditorNoticeToast />
      </div>
    </ThemePortalProvider>
  );
}
