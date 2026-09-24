import { describe, expect, it } from "vitest";
import { createHeaderRule } from "../../../../types/profile/profile-factory";
import { normalizeHeaderRule, parseHeaderRule } from "../header-parser";

describe("header parser", () => {
  it("creates a valid empty rule", () => {
    expect(createHeaderRule()).toMatchObject({
      enabled: true,
      name: "",
      value: "",
      appendMode: "override",
      sendEmptyHeader: false,
    });
  });

  it("normalizes user-entered fields", () => {
    expect(
      normalizeHeaderRule({ ...createHeaderRule(), name: "  X-Test ", comment: " note " }),
    ).toMatchObject({
      name: "X-Test",
      comment: "note",
    });
  });

  it("rejects malformed input", () => {
    expect(parseHeaderRule({ name: "x" })).toBeNull();
  });
});
