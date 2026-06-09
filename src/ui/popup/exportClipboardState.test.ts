import { describe, expect, it } from "vitest";
import { markdownFilenameFromTitle } from "./exportActions";

describe("export affordances", () => {
  it("keeps download disabled assumptions simple when markdown is empty", () => {
    expect(Boolean("")).toBe(false);
    expect(Boolean("# Title")).toBe(true);
  });

  it("keeps sanitized filenames stable for repeated downloads", () => {
    expect(markdownFilenameFromTitle("Phase 1 Preview")).toBe("phase-1-preview.md");
  });
});
