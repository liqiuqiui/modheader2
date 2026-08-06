import { describe, expect, it } from "vitest";
import {
  getProfileShortTitle,
  getProfileTextColor,
  isProfileBackgroundColor,
} from "../profile-appearance";

describe("profile appearance", () => {
  it("accepts only supported hex colors", () => {
    expect(isProfileBackgroundColor("#fff")).toBe(true);
    expect(isProfileBackgroundColor("#2563eb")).toBe(true);
    expect(isProfileBackgroundColor("white")).toBe(false);
    expect(isProfileBackgroundColor("#abcd")).toBe(false);
  });

  it("derives readable text colors with a safe fallback", () => {
    expect(getProfileTextColor("#ffffff")).toBe("black");
    expect(getProfileTextColor("#000000")).toBe("white");
    expect(getProfileTextColor("invalid")).toBe("white");
  });

  it("keeps a Unicode code point intact in the profile badge", () => {
    expect(getProfileShortTitle("配置🔥")).toBe("🔥");
    expect(getProfileShortTitle("家庭👨‍👩‍👧‍👦")).toBe("👨‍👩‍👧‍👦");
    expect(getProfileShortTitle("")).toBe("?");
  });
});
