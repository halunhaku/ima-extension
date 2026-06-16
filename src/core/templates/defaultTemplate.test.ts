import { describe, expect, it } from "vitest";
import { renderDefaultMarkdown } from "./defaultTemplate";

describe("renderDefaultMarkdown", () => {
  it("renders a clean ima note without frontmatter", () => {
    const markdown = renderDefaultMarkdown({
      title: "Structured clipping",
      url: "https://example.com/post",
      site: "Example",
      capturedAt: "2026-06-09T06:00:00.000Z",
      content: "Body paragraph."
    });

    expect(markdown).toBe(`# Structured clipping

Body paragraph.

---

Source: https://example.com/post
Site: Example
Captured: 2026-06-09T06:00:00.000Z`);
    expect(markdown).not.toContain("title:");
    expect(markdown).not.toContain("url:");
  });
});
