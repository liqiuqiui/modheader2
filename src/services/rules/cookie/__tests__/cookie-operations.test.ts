import { describe, expect, it } from "vitest";
import { createCookieRule } from "../cookie-parser";
import { setCookieRuleEnabled } from "../cookie-operations";

describe("cookie operations", () => {
  it("updates enabled state", () => {
    expect(setCookieRuleEnabled(createCookieRule(), false).enabled).toBe(false);
  });
});
