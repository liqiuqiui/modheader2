import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/pages/editor/ProfileEditorApp", () => ({
  ProfileEditorApp: ({ mode }: { mode: "popup" | "options" }) => mode,
}));

import PopupApp from "../popup/App";
import OptionsApp from "../options/App";

describe("editor entrypoints", () => {
  it("mounts popup mode", () => {
    expect(PopupApp().props.mode).toBe("popup");
  });

  it("mounts options mode", () => {
    expect(OptionsApp().props.mode).toBe("options");
  });
});
