import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { SIDEBAR_COLLAPSED_KEY } from "../constants";
import type { EditorMode } from "../types";

export type FocusRequestKind = "header" | "csp" | "cookie" | "filter";

export interface FocusRequest {
  kind: FocusRequestKind;
  id: string;
}

interface EditorUiState {
  mode: EditorMode;
  collapsed: boolean;
  searchQuery: string;
  notice: string;
  focusRequest: FocusRequest | null;
  initialize: (mode: EditorMode) => void;
  setCollapsed: (collapsed: boolean) => void;
  setSearchQuery: (query: string) => void;
  showNotice: (message: string) => void;
  requestFocus: (kind: FocusRequestKind, id: string) => void;
  clearFocusRequest: () => void;
}

let noticeTimer: ReturnType<typeof setTimeout> | null = null;

export const editorUiStore = createStore<EditorUiState>()((set, get) => ({
  mode: "options",
  collapsed: false,
  searchQuery: "",
  notice: "",
  focusRequest: null,

  initialize: (mode) => {
    if (noticeTimer) {
      clearTimeout(noticeTimer);
      noticeTimer = null;
    }
    set({
      mode,
      collapsed: mode === "popup" || window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true",
      searchQuery: "",
      notice: "",
      focusRequest: null,
    });
  },

  setCollapsed: (collapsed) => {
    set({ collapsed });
    if (get().mode === "options") {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  showNotice: (notice) => {
    if (noticeTimer) clearTimeout(noticeTimer);
    set({ notice });
    noticeTimer = setTimeout(() => {
      set({ notice: "" });
      noticeTimer = null;
    }, 2200);
  },

  requestFocus: (kind, id) => set({ focusRequest: { kind, id } }),
  clearFocusRequest: () => set({ focusRequest: null }),
}));

export function useEditorUiStore<T>(selector: (state: EditorUiState) => T): T {
  return useStore(editorUiStore, selector);
}
