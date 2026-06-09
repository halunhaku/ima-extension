export function markdownFilenameFromTitle(title: string): string {
  const safeBase = title
    .trim()
    .toLowerCase()
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${safeBase || "web-clipper-note"}.md`;
}

export function downloadMarkdown(markdown: string, title: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = markdownFilenameFromTitle(title);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
