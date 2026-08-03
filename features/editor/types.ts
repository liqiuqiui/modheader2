import type { Profile } from "../../types";

export type EditorMode = "options" | "popup";

export type FilterKind =
  | "urlPattern"
  | "urlRegex"
  | "tab"
  | "resourceType"
  | "method"
  | "initiator";

export type FilterMode = "include" | "exclude";

export interface FilterView {
  id: string;
  enabled: boolean;
  kind: FilterKind;
  mode: FilterMode;
  value: string | number;
  comment: string;
}

export interface HistorySnapshot {
  profiles: Profile[];
  selectedIndex: number;
}
