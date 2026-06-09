import { describe, expect, it } from "vitest";
import { getSiteCleanupRule, prepareDocumentForExtraction } from "./siteCleanupRules";

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("site cleanup rules", () => {
  it("matches built-in rules by hostname", () => {
    expect(getSiteCleanupRule("https://github.com/mozilla/readability")?.id).toBe("github.com");
    expect(getSiteCleanupRule("https://developer.mozilla.org/en-US/docs/Web/API")?.id).toBe(
      "developer.mozilla.org"
    );
    expect(getSiteCleanupRule("https://web.dev/blog/interop-2025")?.id).toBe("web.dev");
    expect(getSiteCleanupRule("https://www.bbc.co.uk/news/articles/example")?.id).toBe("bbc");
    expect(getSiteCleanupRule("https://example.com/post")).toBeUndefined();
  });

  it("clones preferred content selector when available", () => {
    const document = parse(`
      <html>
        <body>
          <nav>Navigation</nav>
          <main>
            <div id="readme">
              <article><h1>README</h1><p>Important content</p></article>
            </div>
          </main>
        </body>
      </html>
    `);

    const prepared = prepareDocumentForExtraction(document, "https://github.com/org/repo");

    expect(prepared.ruleApplied).toBe("github.com");
    expect(prepared.document.body.textContent).toContain("Important content");
    expect(prepared.document.body.textContent).not.toContain("Navigation");
  });

  it("removes configured noise selectors before extraction", () => {
    const document = parse(`
      <html>
        <body>
          <main id="content">
            <article>
              <h1>Fetch API</h1>
              <aside class="document-toc-container">Table of contents</aside>
              <p>Readable documentation</p>
              <div class="newsletter-container">Subscribe box</div>
            </article>
          </main>
        </body>
      </html>
    `);

    const prepared = prepareDocumentForExtraction(
      document,
      "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch"
    );
    const text = prepared.document.body.textContent ?? "";

    expect(text).toContain("Readable documentation");
    expect(text).not.toContain("Table of contents");
    expect(text).not.toContain("Subscribe box");
  });
});
