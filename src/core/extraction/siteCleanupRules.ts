export interface SiteCleanupRule {
  id: string;
  hostnames: string[];
  removeSelectors: string[];
  preferredContentSelectors: string[];
  titleSelectors: string[];
  noiseSelectors: string[];
}

export interface PreparedExtractionDocument {
  document: Document;
  ruleApplied?: string;
  titleCandidate?: string;
}

export const SITE_CLEANUP_RULES: SiteCleanupRule[] = [
  {
    id: "github.com",
    hostnames: ["github.com", "www.github.com"],
    preferredContentSelectors: ["#readme article", "#readme", "article.markdown-body", ".markdown-body"],
    titleSelectors: ["strong[itemprop='name'] a", "bdi.js-issue-title", "h1"],
    removeSelectors: [
      "header",
      "footer",
      "nav",
      ".Header",
      ".js-header-wrapper",
      ".Layout-sidebar",
      ".file-navigation",
      ".UnderlineNav",
      ".Box-header"
    ],
    noiseSelectors: ["[aria-label='Breadcrumb']", "[data-testid='breadcrumbs']"]
  },
  {
    id: "developer.mozilla.org",
    hostnames: ["developer.mozilla.org"],
    preferredContentSelectors: ["main article", "article", "main"],
    titleSelectors: ["h1"],
    removeSelectors: [
      ".document-toc-container",
      ".newsletter-container",
      ".metadata",
      ".article-footer",
      "aside",
      "nav",
      "footer"
    ],
    noiseSelectors: [".breadcrumbs-container", ".prev-next"]
  },
  {
    id: "web.dev",
    hostnames: ["web.dev", "www.web.dev"],
    preferredContentSelectors: ["main article", "article", "main"],
    titleSelectors: ["h1"],
    removeSelectors: [
      "devsite-header",
      "devsite-book-nav",
      "devsite-footer",
      "devsite-toc",
      "aside",
      "nav",
      "footer",
      ".devsite-article-meta",
      ".devsite-article-nav"
    ],
    noiseSelectors: [".devsite-feedback", ".devsite-banner"]
  },
  {
    id: "bbc",
    hostnames: ["bbc.com", "www.bbc.com", "bbc.co.uk", "www.bbc.co.uk"],
    preferredContentSelectors: ["main article", "article", "main"],
    titleSelectors: ["h1"],
    removeSelectors: [
      "header",
      "footer",
      "nav",
      "aside",
      "[data-component='ad-slot']",
      "[data-testid='ad-slot']",
      "[data-component='links-block']"
    ],
    noiseSelectors: ["[data-component='share-tools']", "[data-component='topic-list']"]
  }
];

function cloneDocument(document: Document): Document {
  return new DOMParser().parseFromString(document.documentElement.outerHTML, "text/html");
}

function documentFromElement(sourceDocument: Document, element: Element): Document {
  const prepared = new DOMParser().parseFromString(
    `<!doctype html><html><head>${sourceDocument.head.innerHTML}</head><body></body></html>`,
    "text/html"
  );
  prepared.body.append(element.cloneNode(true));
  return prepared;
}

function removeMatches(document: Document, selectors: string[]): void {
  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((element) => element.remove());
  }
}

function textFromFirstSelector(document: Document, selectors: string[]): string {
  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function hostnameMatches(hostname: string, allowedHostnames: string[]): boolean {
  return allowedHostnames.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
}

export function getSiteCleanupRule(url: string): SiteCleanupRule | undefined {
  let hostname = "";
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }

  return SITE_CLEANUP_RULES.find((rule) =>
    hostnameMatches(hostname, rule.hostnames.map((host) => host.replace(/^www\./, "")))
  );
}

export function prepareDocumentForExtraction(
  document: Document,
  url: string
): PreparedExtractionDocument {
  const rule = getSiteCleanupRule(url);
  if (!rule) {
    return { document: cloneDocument(document) };
  }

  const titleCandidate = textFromFirstSelector(document, rule.titleSelectors);
  const preferred = rule.preferredContentSelectors
    .map((selector) => document.querySelector(selector))
    .find((element): element is Element => Boolean(element));
  const prepared = preferred ? documentFromElement(document, preferred) : cloneDocument(document);

  removeMatches(prepared, [...rule.removeSelectors, ...rule.noiseSelectors]);

  return {
    document: prepared,
    ruleApplied: rule.id,
    titleCandidate
  };
}
