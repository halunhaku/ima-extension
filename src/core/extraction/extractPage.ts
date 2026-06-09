import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import type { CaptureSourceMode, ExtractedPage, RawPageCapture } from "../../types/capture";
import { renderDefaultMarkdown } from "../templates/defaultTemplate";
import { prepareDocumentForExtraction } from "./siteCleanupRules";

const INCOMPLETE_READER_WARNING = "Reader extraction may be incomplete";
const MIN_READER_TEXT_LENGTH = 140;

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-"
});

function parseDocument(html: string, url: string): Document {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  const base = document.createElement("base");
  base.href = url;
  document.head.prepend(base);
  return document;
}

function getMeta(document: Document, selector: string): string {
  return document.querySelector<HTMLMetaElement>(selector)?.content.trim() ?? "";
}

function cleanTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isNoisyTitle(value: string): boolean {
  const title = cleanTitle(value);
  return (
    title.length === 0 ||
    title.length > 120 ||
    /search code, repositories|mantieni tutto organizzato|save and categorize/i.test(title)
  );
}

function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function textLengthFromHtml(html: string): number {
  const document = parseDocument(`<html><body>${html}</body></html>`, "https://local.invalid/");
  return (document.body.textContent ?? "").replace(/\s+/g, " ").trim().length;
}

function textLengthFromDocument(document: Document): number {
  return (document.body.textContent ?? "").replace(/\s+/g, " ").trim().length;
}

function fallbackHtml(document: Document): string {
  const bodyText = (document.body.textContent ?? "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return bodyText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("");
}

function titleFromReaderHtml(html: string): string {
  const document = parseDocument(`<html><body>${html}</body></html>`, "https://local.invalid/");
  return cleanTitle(document.querySelector("h1")?.textContent ?? "");
}

function titleFromDocument(document: Document): string {
  return cleanTitle(
    document.querySelector("article h1, main h1, [role='main'] h1, h1")?.textContent ?? ""
  );
}

function hasMeaningfulContentRoot(document: Document): boolean {
  return Array.from(document.querySelectorAll("article, main, [role='main']")).some((element) => {
    const length = (element.textContent ?? "").replace(/\s+/g, " ").trim().length;
    return length >= 40;
  });
}

function stripDuplicateTitle(markdown: string, title: string): string {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const duplicateHeading = new RegExp(`^#{1,6}\\s+${escapedTitle}\\s*\\n+`, "i");
  return normalizeMarkdown(markdown.replace(duplicateHeading, ""));
}

function buildResult(input: {
  title: string;
  url: string;
  siteName: string;
  byline: string;
  excerpt: string;
  readerHtml: string;
  contentMarkdown: string;
  capturedAt: string;
  sourceMode: CaptureSourceMode;
  usedSelection: boolean;
  extractionWarning?: string;
  selectedSelector?: string;
  siteRuleApplied?: string;
}): ExtractedPage {
  const contentMarkdown = stripDuplicateTitle(input.contentMarkdown, input.title);
  return {
    title: input.title,
    url: input.url,
    siteName: input.siteName,
    byline: input.byline,
    excerpt: input.excerpt,
    readerHtml: input.readerHtml,
    contentMarkdown,
    capturedAt: input.capturedAt,
    sourceMode: input.sourceMode,
    usedSelection: input.usedSelection,
    extractionWarning: input.extractionWarning,
    selectedSelector: input.selectedSelector,
    siteRuleApplied: input.siteRuleApplied,
    markdown: renderDefaultMarkdown({
      title: input.title,
      url: input.url,
      site: input.siteName,
      capturedAt: input.capturedAt,
      content: contentMarkdown
    })
  };
}

export function extractPage(capture: RawPageCapture): ExtractedPage {
  const sourceDocument = parseDocument(capture.html, capture.url);
  const preparedExtraction = prepareDocumentForExtraction(sourceDocument, capture.url);
  const capturedAt = capture.capturedAt ?? new Date().toISOString();
  const siteName =
    getMeta(sourceDocument, "meta[property='og:site_name']") ||
    new URL(capture.url).hostname.replace(/^www\./, "");
  const metaTitle =
    cleanTitle(getMeta(sourceDocument, "meta[property='og:title']")) ||
    cleanTitle(getMeta(sourceDocument, "meta[name='twitter:title']"));
  const excerpt =
    getMeta(sourceDocument, "meta[name='description']") ||
    getMeta(sourceDocument, "meta[property='og:description']");

  if (capture.selectedHtml?.trim()) {
    const contentMarkdown = normalizeMarkdown(turndown.turndown(capture.selectedHtml));
    const sourceMode = capture.sourceMode ?? "selection";
    return buildResult({
      title: cleanTitle(capture.title),
      url: capture.url,
      siteName,
      byline: "",
      excerpt,
      readerHtml: capture.selectedHtml,
      contentMarkdown,
      capturedAt,
      sourceMode,
      usedSelection: sourceMode === "selection",
      selectedSelector: capture.selectedSelector,
      siteRuleApplied: preparedExtraction.ruleApplied
    });
  }

  const readerDocument = preparedExtraction.document;
  const article = new Readability(readerDocument).parse();
  const articleHtml = article?.content?.trim() ?? "";
  const articleTextLength = textLengthFromHtml(articleHtml);
  const bodyTextLength = textLengthFromDocument(sourceDocument);
  const hasStrongRoot = hasMeaningfulContentRoot(sourceDocument);
  const shouldFallback =
    !articleHtml ||
    (articleTextLength < MIN_READER_TEXT_LENGTH &&
      (bodyTextLength > articleTextLength * 2 || !hasStrongRoot));
  const readerHtml = shouldFallback ? fallbackHtml(sourceDocument) : articleHtml;
  const contentMarkdown = normalizeMarkdown(turndown.turndown(readerHtml));
  const htmlTitle = titleFromReaderHtml(readerHtml) || titleFromDocument(sourceDocument);
  const readerTitle = isNoisyTitle(htmlTitle) ? "" : htmlTitle;
  const ruleTitle = cleanTitle(preparedExtraction.titleCandidate ?? "");
  const siteRuleTitle = isNoisyTitle(ruleTitle) ? "" : ruleTitle;
  const sourceMode: CaptureSourceMode = shouldFallback ? "fallback" : "auto";

  return buildResult({
    title:
      readerTitle ||
      siteRuleTitle ||
      metaTitle ||
      cleanTitle(article?.title ?? "") ||
      cleanTitle(capture.title),
    url: capture.url,
    siteName,
    byline: article?.byline?.trim() ?? "",
    excerpt: article?.excerpt?.trim() || excerpt,
    readerHtml,
    contentMarkdown,
    capturedAt,
    sourceMode,
    usedSelection: false,
    extractionWarning: shouldFallback ? INCOMPLETE_READER_WARNING : undefined,
    siteRuleApplied: preparedExtraction.ruleApplied
  });
}
