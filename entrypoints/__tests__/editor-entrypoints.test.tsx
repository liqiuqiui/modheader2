import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The editor mounts the whole store, so the component is stubbed — but the entry
// point itself is rendered for real, which is what these tests are about.
vi.mock("../../src/pages/editor/ProfileEditorApp", () => ({
  ProfileEditorApp: ({ mode }: { mode: "popup" | "options" }) => mode,
}));

import OptionsApp from "../options/App";
import PopupApp from "../popup/App";

describe("editor entrypoints", () => {
  it("mounts popup mode", () => {
    expect(renderToStaticMarkup(createElement(PopupApp))).toBe("popup");
  });

  it("mounts options mode", () => {
    expect(renderToStaticMarkup(createElement(OptionsApp))).toBe("options");
  });
});
