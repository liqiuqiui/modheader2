import { describe, expect, it } from "vitest";
import { createRedirectRule } from "../redirect-parser";
import { patchRedirectRule } from "../redirect-operations";

describe("redirect operations", () => {
  it("preserves identity while patching", () => {
    const rule = createRedirectRule();
    expect(patchRedirectRule(rule, { value: "https://example.com" })).toMatchObject({
      id: rule.id,
      value: "https://example.com",
    });
  });
});
