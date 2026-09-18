import { nanoid } from "nanoid";
import type { UrlReplacementRule } from "../../../types/profile/profile-model";

export function createRedirectRule(
  overrides: Partial<UrlReplacementRule> = {},
): UrlReplacementRule {
  return {
    id: nanoid(),
    enabled: true,
    name: "",
    value: "",
    comment: "",
    ...overrides,
  };
}
