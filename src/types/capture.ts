export type CaptureSourceMode = "auto" | "selection" | "manualArea" | "fallback";

export interface RawPageCapture {
  title: string;
  url: string;
  html: string;
  capturedAt?: string;
  sourceMode?: CaptureSourceMode;
  selectedHtml?: string;
  selectedText?: string;
  selectedSelector?: string;
}

export interface ExtractedPage {
  title: string;
  url: string;
  siteName: string;
  byline: string;
  excerpt: string;
  readerHtml: string;
  markdown: string;
  contentMarkdown: string;
  capturedAt: string;
  sourceMode: CaptureSourceMode;
  usedSelection: boolean;
  extractionWarning?: string;
  selectedSelector?: string;
  siteRuleApplied?: string;
}
