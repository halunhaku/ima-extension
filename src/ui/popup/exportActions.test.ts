import { describe, expect, it, vi } from "vitest";
import { downloadMarkdown, markdownFilenameFromTitle } from "./exportActions";

describe("export actions", () => {
  it("sanitizes markdown filenames from page titles", () => {
    expect(markdownFilenameFromTitle("Hello: Web / Clipper?")).toBe("hello-web-clipper.md");
    expect(markdownFilenameFromTitle("  ")).toBe("web-clipper-note.md");
    expect(markdownFilenameFromTitle("ima 知识采集")).toBe("ima-知识采集.md");
  });

  it("downloads markdown with a sanitized filename", () => {
    const createObjectURL = vi.fn(() => "blob:markdown");
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    HTMLAnchorElement.prototype.click = click;

    try {
      downloadMarkdown("# Title", "Title / With : Characters");
      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(click).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:markdown");
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });
});
