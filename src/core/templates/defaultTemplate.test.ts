import { describe, expect, it } from "vitest";
import { renderDefaultMarkdown } from "./defaultTemplate";

describe("renderDefaultMarkdown", () => {
  it("wraps clipped content in the default ima markdown template", () => {
    const markdown = renderDefaultMarkdown({
      title: "Structured clipping",
      url: "https://example.com/post",
      site: "Example",
      capturedAt: "2026-06-09T06:00:00.000Z",
      content: "Body paragraph."
    });

    expect(markdown).toBe(`---
title: Structured clipping
url: https://example.com/post
site: Example
captured: 2026-06-09T06:00:00.000Z
------------------------

# Structured clipping

Body paragraph.`);
  });
});
