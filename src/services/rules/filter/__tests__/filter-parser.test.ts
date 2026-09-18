import { describe, expect, it } from "vitest";
import { createFilter, isFilterValue, parseFilter } from "../filter-parser";

describe("filter parser", () => {
  it("uses the current tab as the default tab filter value", () => {
    expect(createFilter({ kind: "tab", currentTabId: 42 })).toMatchObject({
      kind: "tab",
      value: 42,
    });
  });

  it("uses type-specific defaults", () => {
    expect(createFilter({ kind: "resourceType" }).value).toBe("xmlhttprequest");
    expect(createFilter({ kind: "method" }).value).toBe("get");
  });

  it("validates values by filter kind", () => {
    expect(isFilterValue("tab", -1)).toBe(false);
    expect(isFilterValue("method", "get")).toBe(true);
    expect(isFilterValue("resourceType", "script")).toBe(true);
  });

  it("rejects malformed filters", () => {
    expect(parseFilter({ kind: "tab", value: "not-a-tab" })).toBeNull();
  });
});
