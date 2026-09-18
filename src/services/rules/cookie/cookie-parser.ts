import { nanoid } from "nanoid";
import type { NameValueRule } from "../../../types/profile/profile-model";

export function createCookieRule(overrides: Partial<NameValueRule> = {}): NameValueRule {
  return {
    id: nanoid(),
    enabled: true,
    name: "",
    value: "",
    comment: "",
    ...overrides,
  };
}
