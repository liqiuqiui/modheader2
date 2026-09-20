import { describe, expect, it } from "vitest";
import { FILTER_KINDS } from "../../../../types/profile/profile-model";
import { createFilter, isFilterValue, parseFilter } from "../filter-parser";

describe("filter parser", () => {
  it("uses the current tab as the default tab filter value", () => {
    expect(createFilter({ kind: "tab", currentTabId: 42 })).toMatchObject({
      kind: "tab",
      value: 42,
    });
  });

  it("uses type-specific defaults", () => {
    expect(FILTER_KINDS).toContain("time");
    expect(createFilter({ kind: "resourceType" }).value).toBe("xmlhttprequest");
    expect(createFilter({ kind: "method" }).value).toBe("get");
    expect(createFilter({ kind: "time" }).value).toBeGreaterThan(Date.now());
  });

  it("validates values by filter kind", () => {
    expect(isFilterValue("tab", -1)).toBe(false);
    expect(isFilterValue("method", "get")).toBe(true);
    expect(isFilterValue("resourceType", "script")).toBe(true);
    expect(isFilterValue("time", Date.now() + 60_000)).toBe(true);
    expect(isFilterValue("time", -1)).toBe(false);
  });

  it("rejects malformed filters", () => {
    expect(parseFilter({ kind: "tab", value: "not-a-tab" })).toBeNull();
  });
});
