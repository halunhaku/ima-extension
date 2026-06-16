import { describe, expect, it } from "vitest";
import { extractPage } from "./extractPage";

describe("extractPage", () => {
  it("extracts article content and converts it to markdown", () => {
    const result = extractPage({
      title: "Browser title",
      url: "https://example.com/articles/reader",
      html: `
        <html>
          <head>
            <title>Ignored browser title</title>
            <meta property="og:site_name" content="Example Journal">
            <meta name="description" content="A practical clipping article">
          </head>
          <body>
            <article>
              <h1>Reader Mode Matters</h1>
              <p>Useful paragraphs should survive extraction.</p>
              <p><strong>Important</strong> details become markdown.</p>
            </article>
            <nav>Navigation noise</nav>
          </body>
        </html>
      `
    });

    expect(result.title).toBe("Reader Mode Matters");
    expect(result.siteName).toBe("Example Journal");
    expect(result.excerpt).toBe("A practical clipping article");
    expect(result.markdown).toContain("Source: https://example.com/articles/reader");
    expect(result.markdown).toContain("Site: Example Journal");
    expect(result.markdown).not.toContain("title:");
    expect(result.markdown).toContain("# Reader Mode Matters");
    expect(result.markdown).toContain("Useful paragraphs should survive extraction.");
    expect(result.markdown).toContain("**Important** details become markdown.");
    expect(result.markdown).not.toContain("Navigation noise");
    expect(result.usedSelection).toBe(false);
    expect(result.sourceMode).toBe("auto");
  });

  it("uses selected html before full page html", () => {
    const result = extractPage({
      title: "Selection Page",
      url: "https://example.com/selection",
      capturedAt: "2026-06-09T06:10:00.000Z",
      selectedHtml: "<p>Only this selected idea should be clipped.</p>",
      selectedText: "Only this selected idea should be clipped.",
      html: "<html><body><article><p>The full article should not appear.</p></article></body></html>"
    });

    expect(result.title).toBe("Selection Page");
    expect(result.url).toBe("https://example.com/selection");
    expect(result.capturedAt).toBe("2026-06-09T06:10:00.000Z");
    expect(result.markdown).toContain("Captured: 2026-06-09T06:10:00.000Z");
    expect(result.markdown).toContain("Only this selected idea should be clipped.");
    expect(result.markdown).not.toContain("The full article should not appear.");
    expect(result.usedSelection).toBe(true);
    expect(result.sourceMode).toBe("selection");
  });

  it("falls back to body inner text and warns when readability content is too short", () => {
    const result = extractPage({
      title: "Fallback Page",
      url: "https://example.com/fallback",
      html: `<html>
        <body>
          <nav>Home Docs Pricing</nav>
          <main><button>Open</button></main>
          <section>Fallback content remains available when article extraction fails.</section>
        </body>
      </html>`
    });

    expect(result.title).toBe("Fallback Page");
    expect(result.markdown).toContain("Fallback content remains available when article extraction fails.");
    expect(result.readerHtml).toContain("Fallback content remains available when article extraction fails.");
    expect(result.extractionWarning).toBe("Reader extraction may be incomplete");
    expect(result.sourceMode).toBe("fallback");
  });

  it("preserves images and code blocks in markdown content", () => {
    const result = extractPage({
      title: "Technical Page",
      url: "https://docs.example.com/start",
      html: `
        <html>
          <body>
            <article>
              <h1>Install the package</h1>
              <p>Use the command below.</p>
              <img src="https://cdn.example.com/diagram.png" alt="Architecture diagram">
              <pre><code>npm install web-clipper</code></pre>
            </article>
          </body>
        </html>
      `
    });

    expect(result.contentMarkdown).toContain("![Architecture diagram](https://cdn.example.com/diagram.png)");
    expect(result.contentMarkdown).toContain("```");
    expect(result.contentMarkdown).toContain("npm install web-clipper");
  });

  it("ignores noisy page h1 text and uses metadata title", () => {
    const result = extractPage({
      title: "Fallback browser title",
      url: "https://example.com/noisy-title",
      html: `
        <html>
          <head>
            <meta property="og:title" content="Clean article title">
          </head>
          <body>
            <main>
              <h1>Search code, repositories, users, issues, pull requests...</h1>
              <article>
                <p>${"Readable content ".repeat(20)}</p>
              </article>
            </main>
          </body>
        </html>
      `
    });

    expect(result.title).toBe("Clean article title");
    expect(result.markdown).toContain("# Clean article title");
    expect(result.markdown).not.toContain("title: Clean article title");
  });

  it("uses preferred site content selectors before readability", () => {
    const result = extractPage({
      title: "GitHub page",
      url: "https://github.com/example/project",
      html: `
        <html>
          <head><meta property="og:title" content="example/project"></head>
          <body>
            <header>GitHub navigation</header>
            <main>
              <div id="readme">
                <article>
                  <h1>Project README</h1>
                  <p>${"README content ".repeat(20)}</p>
                </article>
              </div>
            </main>
            <footer>Footer navigation</footer>
          </body>
        </html>
      `
    });

    expect(result.siteRuleApplied).toBe("github.com");
    expect(result.markdown).toContain("README content");
    expect(result.markdown).not.toContain("GitHub navigation");
    expect(result.markdown).not.toContain("Footer navigation");
  });

  it("keeps template rendering stable for manual area source mode", () => {
    const result = extractPage({
      title: "Manual page",
      url: "https://example.com/manual",
      sourceMode: "manualArea",
      selectedSelector: "main article",
      selectedHtml: "<article><h1>Manual section</h1><p>Chosen content.</p></article>",
      selectedText: "Manual section Chosen content.",
      html: "<html><body><main><article><h1>Manual section</h1></article></main></body></html>"
    });

    expect(result.sourceMode).toBe("manualArea");
    expect(result.selectedSelector).toBe("main article");
    expect(result.markdown).toContain("# Manual page");
    expect(result.markdown).not.toContain("title: Manual page");
    expect(result.markdown).toContain("Chosen content.");
  });
});
