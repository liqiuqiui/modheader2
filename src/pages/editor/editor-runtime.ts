import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../store/app-store";
import { appStore } from "../../store/app-store";

import type { EditorMode } from "./types";

export function useEditorRuntime(locale: "en" | "zh-CN", mode: EditorMode) {
  const initialize = useAppStore((state) => state.initialize);
  const snapshot = useAppStore(
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

  useEffect(() => appStore.getState().initializeEditor(mode), [mode]);

  useEffect(() => {
    void initialize(locale);
  }, [initialize, locale]);

  return {
    ...snapshot,
    titleRef,
    renameRequestedRef,
    fileInputRef,
    colorInputRef,
    colorTargetProfileIdRef,
  };
}
