import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { clsx } from "clsx";
import { browser } from "wxt/browser";
import { useTranslation } from "react-i18next";
import { ThemePortalProvider } from "../../components/ThemePortalProvider";
import {
  addProfile,
  cloneProfile,
  deleteProfile,
  loadState,
  normalizeProfiles,
  profilesStorage,
  saveProfiles,
  selectedIndexStorage,
  updateProfile,
} from "../../store";
import type { AppState, HeaderRule, Profile } from "../../types";
import { EditorInputs } from "./components/EditorInputs";
import { EditorSections } from "./components/EditorSections";
import { EditorToolbar } from "./components/EditorToolbar";
import { NoticeToast } from "./components/NoticeToast";
import { ProfileStatusCard } from "./components/ProfileStatusCard";
import { QuickAddActions } from "./components/QuickAddActions";
import { Sidebar } from "./components/Sidebar";
import { SIDEBAR_COLLAPSED_KEY } from "./constants";
import { useBrowserTabs } from "./hooks/useBrowserTabs";
import type { EditorMode, HistorySnapshot } from "./types";

export function ProfileEditorApp({ mode = "options" }: { mode?: EditorMode } = {}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "en" ? "en" : "zh-CN";
  const [state, setState] = useState<AppState>({ profiles: [], selectedProfileIndex: 0 });
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(mode === "popup");
  const [searchQuery, setSearchQuery] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const { tabs, currentTabId } = useBrowserTabs();
  const [history, setHistory] = useState<{ past: HistorySnapshot[]; future: HistorySnapshot[] }>({
    past: [],
    future: [],
  });
  const [notice, setNotice] = useState("");
  const [focusHeaderId, setFocusHeaderId] = useState<string | null>(null);
  const [focusCookieId, setFocusCookieId] = useState<string | null>(null);
  const [focusFilterId, setFocusFilterId] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const renameRequestedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCollapsed(
      mode === "popup" ? true : window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true",
    );
    loadState().then((next) => {
      setState(next);
      setLoaded(true);
    });
    const unwatchProfiles = profilesStorage.watch((profiles) =>
      setState((current) => ({ ...current, profiles: normalizeProfiles(profiles) })),
    );
    const unwatchIndex = selectedIndexStorage.watch((selectedProfileIndex) =>
      setState((current) => ({ ...current, selectedProfileIndex })),
    );
    return () => {
      unwatchProfiles();
      unwatchIndex();
    };
  }, [mode]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const profile = state.profiles[state.selectedProfileIndex];

  useEffect(() => {
    setTitleDraft(profile?.title ?? "");
  }, [profile?.id]);

  const handleCollapsedChange = (nextCollapsed: boolean) => {
    setCollapsed(nextCollapsed);
    if (mode !== "popup") window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(nextCollapsed));
  };

  const snapshot = (): HistorySnapshot => ({
    profiles: state.profiles,
    selectedIndex: state.selectedProfileIndex,
  });

  const remember = () =>
    setHistory((current) => ({ past: [...current.past, snapshot()].slice(-50), future: [] }));

  const handleUpdateProfile = async (patch: Partial<Profile>) => {
    if (!profile) return;
    remember();
    const profiles = await updateProfile(state.profiles, state.selectedProfileIndex, patch);
    setState((current) => ({ ...current, profiles }));
  };

  const handleConvertHeader = async (rule: HeaderRule, target: "request" | "response") => {
    if (!profile) return;
    if (target === "response") {
      await handleUpdateProfile({
        headers: profile.headers.filter((item) => item.id !== rule.id),
        respHeaders: [...profile.respHeaders, rule],
      });
      return;
    }
    await handleUpdateProfile({
      headers: [...profile.headers, rule],
      respHeaders: profile.respHeaders.filter((item) => item.id !== rule.id),
    });
  };

  const handleSelect = async (index: number) => {
    await selectedIndexStorage.setValue(index);
    setState((current) => ({ ...current, selectedProfileIndex: index }));
  };

  const handleAdd = async () => {
    remember();
    const result = await addProfile(state.profiles, locale);
    setState((current) => ({
      ...current,
      profiles: result.profiles,
      selectedProfileIndex: result.index,
    }));
  };

  const handleClone = async () => {
    if (!profile) return;
    remember();
    const result = await cloneProfile(state.profiles, state.selectedProfileIndex, locale);
    setState((current) => ({
      ...current,
      profiles: result.profiles,
      selectedProfileIndex: result.index,
    }));
    setNotice(t("profile.cloned"));
  };

  const handleDelete = async () => {
    if (!profile || !window.confirm(t("profile.deleteConfirm", { title: profile.title }))) return;
    remember();
    const result = await deleteProfile(state.profiles, state.selectedProfileIndex);
    setState((current) => ({
      ...current,
      profiles: result.profiles,
      selectedProfileIndex: result.index,
    }));
  };

  const requestTitleRename = () => {
    renameRequestedRef.current = true;
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

  const restoreSnapshot = async (target: HistorySnapshot) => {
    await saveProfiles(target.profiles, target.selectedIndex);
    setState((current) => ({
      ...current,
      profiles: target.profiles,
      selectedProfileIndex: target.selectedIndex,
    }));
  };

  const undo = async () => {
    const target = history.past.at(-1);
    if (!target) return;
    const current = snapshot();
    setHistory((value) => ({
      past: value.past.slice(0, -1),
      future: [current, ...value.future].slice(0, 50),
    }));
    await restoreSnapshot(target);
  };

  const redo = async () => {
    const target = history.future[0];
    if (!target) return;
    const current = snapshot();
    setHistory((value) => ({
      past: [...value.past, current].slice(-50),
      future: value.future.slice(1),
    }));
    await restoreSnapshot(target);
  };

  const exportProfile = () => {
    if (!profile) return;
    const blob = new Blob([JSON.stringify({ version: 2, profiles: [profile] }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${profile.title.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "profile"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(t("profile.exported"));
  };

  const copyProfile = async () => {
    if (!profile) return;
    await navigator.clipboard.writeText(
      JSON.stringify({ version: 2, profiles: [profile] }, null, 2),
    );
    setNotice(t("profile.copied"));
  };

  const importProfiles = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Profile[] | { profiles?: Profile[] };
      const imported = normalizeProfiles(Array.isArray(parsed) ? parsed : parsed.profiles);
      if (imported.length === 0) throw new Error(t("import.empty"));
      remember();
      const profiles = [...state.profiles, ...imported];
      const selectedIndex = state.profiles.length;
      await saveProfiles(profiles, selectedIndex);
      setState((current) => ({ ...current, profiles, selectedProfileIndex: selectedIndex }));
      setNotice(t("import.success", { count: imported.length }));
    } catch (error) {
      window.alert(
        t("import.failed", {
          message: error instanceof Error ? error.message : t("import.invalid"),
        }),
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sortRules = async () => {
    if (!profile) return;
    await handleUpdateProfile({
      headers: [...profile.headers].sort((a, b) => a.name.localeCompare(b.name)),
      respHeaders: [...profile.respHeaders].sort((a, b) => a.name.localeCompare(b.name)),
      urlFilters: [...profile.urlFilters].sort((a, b) => a.urlRegex.localeCompare(b.urlRegex)),
      excludeUrlFilters: [...profile.excludeUrlFilters].sort((a, b) =>
        a.urlRegex.localeCompare(b.urlRegex),
      ),
    });
    setNotice(t("sort.success"));
  };

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
        {t("common.loading")}
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
        {t("profile.none")}
      </div>
    );
  }

  return (
    <ThemePortalProvider themeColor={profile.backgroundColor}>
      <div
        className={clsx(
          "flex overflow-hidden bg-slate-100 text-slate-800",
          mode === "popup" ? "h-[580px] w-[780px]" : "h-screen w-full",
        )}
        style={{ "--theme-color": profile.backgroundColor } as CSSProperties}
      >
        <Sidebar
          mode={mode}
          collapsed={collapsed}
          profiles={state.profiles}
          selectedIndex={state.selectedProfileIndex}
          searchQuery={searchQuery}
          onCollapsedChange={handleCollapsedChange}
          onSearchChange={setSearchQuery}
          onSelect={(index) => void handleSelect(index)}
          onImport={() => fileInputRef.current?.click()}
          onSort={() => void sortRules()}
        />

        <main
          className={clsx(
            "flex min-w-0 flex-1 flex-col transition-[filter] duration-200",
            profile.paused && "grayscale",
          )}
        >
          <EditorToolbar
            profile={profile}
            profileNumber={state.selectedProfileIndex + 1}
            titleDraft={titleDraft}
            titleRef={titleRef}
            locale={locale}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
            onTitleDraftChange={setTitleDraft}
            onTitleCommit={(nextTitle) => {
              setTitleDraft(nextTitle);
              if (nextTitle !== profile.title) void handleUpdateProfile({ title: nextTitle });
            }}
            onUndo={() => void undo()}
            onRedo={() => void redo()}
            onAddProfile={() => void handleAdd()}
            onTogglePause={() => void handleUpdateProfile({ paused: !profile.paused })}
            onExport={exportProfile}
            onOpenOptions={() => {
              void browser.runtime.openOptionsPage();
              window.close();
            }}
            onLanguageChange={(nextLocale) => void i18n.changeLanguage(nextLocale)}
            onRequestRename={requestTitleRename}
            onClone={() => void handleClone()}
            onPickColor={() => window.setTimeout(() => colorInputRef.current?.click(), 0)}
            onCopy={() => void copyProfile()}
            onDelete={() => void handleDelete()}
            onProfileMenuCloseAutoFocus={handleProfileMenuCloseAutoFocus}
          />

          <div className="flex-1 overflow-y-auto">
            <div
              className={clsx(
                "mx-auto w-full max-w-6xl",
                mode === "popup" ? "px-4 py-4" : "px-4 py-5 sm:px-6",
              )}
            >
              {mode !== "popup" && (
                <ProfileStatusCard
                  profile={profile}
                  onEnabledChange={(enabled) => void handleUpdateProfile({ enabled })}
                />
              )}
              <EditorSections
                mode={mode}
                profile={profile}
                tabs={tabs}
                currentTabId={currentTabId}
                searchQuery={searchQuery}
                focusHeaderId={focusHeaderId}
                focusCookieId={focusCookieId}
                focusFilterId={focusFilterId}
                onUpdate={(patch) => void handleUpdateProfile(patch)}
                onConvertHeader={(rule, target) => void handleConvertHeader(rule, target)}
              />
              <QuickAddActions
                mode={mode}
                profile={profile}
                onUpdate={(patch) => void handleUpdateProfile(patch)}
                onFocusHeader={setFocusHeaderId}
                onFocusCookie={setFocusCookieId}
                onFocusFilter={setFocusFilterId}
              />
            </div>
          </div>
        </main>

        <EditorInputs
          profile={profile}
          fileInputRef={fileInputRef}
          colorInputRef={colorInputRef}
          onImport={(file) => void importProfiles(file)}
          onColorChange={(backgroundColor) =>
            void handleUpdateProfile({ backgroundColor, textColor: "white" })
          }
        />
        <NoticeToast message={notice} />
      </div>
    </ThemePortalProvider>
  );
}
