import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractPage } from "./extractPage";

function readFixture(name: string): string {
  return readFileSync(join(process.cwd(), "tests", "fixtures", "pages", name), "utf8");
}

describe("fixture extraction regression", () => {
  it("extracts GitHub README without navigation and preserves code", () => {
    const result = extractPage({
      title: "GitHub README",
      url: "https://github.com/example/clipper",
      html: readFixture("github-readme.html"),
      capturedAt: "2026-06-09T00:00:00.000Z"
    });

    expect(result.title).toBe("clipper");
    expect(result.siteRuleApplied).toBe("github.com");
    expect(result.contentMarkdown.length).toBeGreaterThan(120);
    expect(result.contentMarkdown).toContain("Fixture README");
    expect(result.contentMarkdown).toContain("```");
    expect(result.contentMarkdown).toContain("npm install web-clipper-for-ima");
    expect(result.contentMarkdown).not.toContain("Pull requests");
    expect(result.contentMarkdown).not.toContain("GitHub footer");
  });

  it("extracts MDN docs and removes doc chrome", () => {
    const result = extractPage({
      title: "MDN Fetch",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch",
      html: readFixture("mdn-doc.html")
    });

    expect(result.title).toBe("Using the Fetch API");
    expect(result.siteRuleApplied).toBe("developer.mozilla.org");
    expect(result.contentMarkdown.length).toBeGreaterThan(120);
    expect(result.contentMarkdown).toContain("The Fetch API provides");
    expect(result.contentMarkdown).toContain("fetch()");
    expect(result.contentMarkdown).not.toContain("In this article");
    expect(result.contentMarkdown).not.toContain("Subscribe to MDN");
  });

  it("extracts web.dev article and preserves technical content", () => {
    const result = extractPage({
      title: "web.dev",
      url: "https://web.dev/blog/interop-2025?hl=en",
      html: readFixture("web-dev-article.html")
    });

    expect(result.title).toContain("Interop 2025");
    expect(result.siteRuleApplied).toBe("web.dev");
    expect(result.contentMarkdown.length).toBeGreaterThan(120);
    expect(result.contentMarkdown).toContain("cross-browser effort");
    expect(result.contentMarkdown).toContain("@supports");
    expect(result.contentMarkdown).not.toContain("Products Resources");
    expect(result.contentMarkdown).not.toContain("Feedback Terms");
  });

  it("extracts BBC article body without ad chrome", () => {
    const result = extractPage({
      title: "BBC",
      url: "https://www.bbc.com/news/articles/example",
      html: readFixture("bbc-news.html")
    });

    expect(result.title).toBe("World leaders meet for climate summit");
    expect(result.siteRuleApplied).toBe("bbc");
    expect(result.contentMarkdown.length).toBeGreaterThan(120);
    expect(result.contentMarkdown).toContain("climate financing");
    expect(result.contentMarkdown).toContain("continue through the week");
    expect(result.contentMarkdown).not.toContain("Advertisement");
    expect(result.contentMarkdown).not.toContain("BBC footer");
  });

  it("extracts a generic blog through the default readability path", () => {
    const result = extractPage({
      title: "Generic Blog",
      url: "https://example.com/blog/clipping",
      html: readFixture("generic-blog.html")
    });

    expect(result.title).toBe("Designing better clipping tools");
    expect(result.siteRuleApplied).toBeUndefined();
    expect(result.contentMarkdown.length).toBeGreaterThan(100);
    expect(result.contentMarkdown).toContain("Knowledge capture works best");
    expect(result.contentMarkdown).not.toContain("Home Archive");
  });
});
