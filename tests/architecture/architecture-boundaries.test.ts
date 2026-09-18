import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.(ts|tsx)$/.test(path)
        ? [path]
        : [];
  });
}

describe("architecture boundaries", () => {
  it("does not reintroduce legacy profile layer names or store imports", () => {
    const files = [...sourceFiles(join(process.cwd(), "src"))];
    const violations = files
      .filter((file) => !file.endsWith("architecture-boundaries.test.ts"))
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return /(modules\/profile|features\/|profile-store|useProfileStore)/.test(source)
          ? [file]
          : [];
      });
    expect(violations).toEqual([]);
  });
});
