import { describe, expect, it } from "vitest";
import { createCspRule } from "../csp-parser";
import { patchCspRule } from "../csp-operations";

describe("csp operations", () => {
  it("preserves identity while patching", () => {
    const rule = createCspRule();
    expect(patchCspRule(rule, { directive: "script-src" })).toMatchObject({
      id: rule.id,
      directive: "script-src",
    });
  });
});
