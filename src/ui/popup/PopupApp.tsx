import {
  AlertTriangle,
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  Link,
  MousePointer2,
  RefreshCw,
  Type
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { extractPage } from "../../core/extraction/extractPage";
import type { ExtractedPage, RawPageCapture } from "../../types/capture";
import { downloadMarkdown } from "./exportActions";
import { renderMarkdownPreview } from "./markdownPreview";
import {
  clearManualAreaSessionCache,
  shouldShowBackToAuto
} from "./manualAreaState";
import { resolvePreferredCapture } from "./popupCapture";

type ViewMode = "reader" | "markdown" | "preview";

interface LoadState {
  status: "idle" | "loading" | "ready" | "error";
  message: string;
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("No active tab is available.");
  }
  return tab;
}

async function captureActivePage(): Promise<RawPageCapture> {
  const tab = await getActiveTab();

  try {
    return await chrome.tabs.sendMessage(tab.id as number, {
      type: "IMA_CLIPPER_CAPTURE_PAGE"
    });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id as number },
      files: ["assets/content.js"]
    });
    return chrome.tabs.sendMessage(tab.id as number, {
      type: "IMA_CLIPPER_CAPTURE_PAGE"
    });
  }
}

async function startManualAreaCapture(): Promise<RawPageCapture | null> {
  const tab = await getActiveTab();

  try {
    const response = await chrome.tabs.sendMessage(tab.id as number, {
      type: "IMA_CLIPPER_START_AREA_SELECTION"
    });
    return response?.capture ?? null;
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id as number },
      files: ["assets/content.js"]
    });
    const response = await chrome.tabs.sendMessage(tab.id as number, {
      type: "IMA_CLIPPER_START_AREA_SELECTION"
    });
    return response?.capture ?? null;
  }
}

function sourceModeLabel(page: ExtractedPage): string {
  if (page.sourceMode === "manualArea") {
    return "Manual Area";
  }
  if (page.sourceMode === "selection") {
    return "Selection";
  }
  if (page.sourceMode === "fallback") {
    return "Fallback";
  }
  return "Auto";
}

function sourceModeClass(page: ExtractedPage): string {
  if (page.sourceMode === "manualArea") {
    return "source-badge source-badge-manual";
  }
  if (page.sourceMode === "selection") {
    return "source-badge source-badge-selection";
  }
  if (page.sourceMode === "fallback") {
    return "source-badge source-badge-fallback";
  }
  return "source-badge source-badge-auto";
}

export function PopupApp() {
  const [page, setPage] = useState<ExtractedPage | null>(null);
  const [mode, setMode] = useState<ViewMode>("reader");
  const [actionState, setActionState] = useState<string>("");
  const [loadState, setLoadState] = useState<LoadState>({
    status: "idle",
    message: ""
  });

  const previewHtml = useMemo(() => renderMarkdownPreview(page?.markdown ?? ""), [page?.markdown]);

  const loadPage = useCallback(async (options?: { ignorePendingManualArea?: boolean }) => {
    setLoadState({ status: "loading", message: "Extracting this page..." });
    setActionState("");

    try {
      const capture = await resolvePreferredCapture({
        captureActivePage,
        storage: chrome.storage.session,
        ignorePendingManualArea: options?.ignorePendingManualArea
      });
      const extracted = extractPage(capture);
      setPage(extracted);
      setLoadState({
        status: "ready",
        message: extracted.markdown.trim() ? "" : "No readable content was found on this page."
      });
    } catch (error) {
      setPage(null);
      setLoadState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "This page cannot be captured. Try refreshing the tab and opening the clipper again."
      });
    }
  }, []);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  async function copyMarkdown() {
    if (!page?.markdown) {
      return;
    }

    await navigator.clipboard.writeText(page.markdown);
    setActionState("Markdown copied");
    window.setTimeout(() => setActionState(""), 1600);
  }

  async function copySourceUrl() {
    if (!page?.url) {
      return;
    }

    await navigator.clipboard.writeText(page.url);
    setActionState("URL copied");
    window.setTimeout(() => setActionState(""), 1600);
  }

  async function copyTitle() {
    if (!page?.title) {
      return;
    }

    await navigator.clipboard.writeText(page.title);
    setActionState("Title copied");
    window.setTimeout(() => setActionState(""), 1600);
  }

  function downloadCurrentMarkdown() {
    if (!page?.markdown) {
      return;
    }

    downloadMarkdown(page.markdown, page.title);
    setActionState("Markdown downloaded");
    window.setTimeout(() => setActionState(""), 1600);
  }

  function openIma() {
    void chrome.tabs.create({ url: "https://ima.qq.com/" });
  }

  async function selectArea() {
    setLoadState({
      status: "loading",
      message: "Select an area on the page. Press Esc to cancel."
    });
    setActionState("");

    try {
      const capture = await startManualAreaCapture();
      if (!capture) {
        setLoadState({ status: page ? "ready" : "idle", message: "Area selection canceled." });
      }
    } catch (error) {
      setLoadState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Area selection failed. Try refreshing the tab and opening the clipper again."
      });
    }
  }

  return (
    <main className="flex h-[680px] w-[520px] flex-col bg-[#f7f7f4] text-zinc-950">
      <header className="px-5 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-500">
              <span>ima Clipper</span>
              {page ? <span className={sourceModeClass(page)}>{sourceModeLabel(page)}</span> : null}
            </div>
            <h1 className="mt-2 line-clamp-2 text-[17px] font-semibold leading-6 text-zinc-950">
              {page?.title ?? "Current page"}
            </h1>
          </div>
          <button
            className="icon-button"
            type="button"
            title="Refresh capture"
            onClick={() => void loadPage()}
            disabled={loadState.status === "loading"}
          >
            <RefreshCw size={17} />
          </button>
        </div>
        <div className="mt-3 flex min-w-0 items-center gap-2 text-[11px] text-zinc-500">
          <span className="truncate">{page?.siteName ?? "No page loaded"}</span>
          {page ? (
            <>
              <span className="text-zinc-300">/</span>
              <span className="shrink-0">{new Date(page.capturedAt).toLocaleTimeString()}</span>
            </>
          ) : null}
          {page?.siteRuleApplied ? (
            <>
              <span className="text-zinc-300">/</span>
              <span className="site-rule-badge">{page.siteRuleApplied}</span>
            </>
          ) : null}
        </div>
      </header>

      <div className="px-5 pb-3">
        <nav className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-200/60 p-1">
          {(["reader", "markdown", "preview"] as const).map((tab) => (
            <button
              key={tab}
              className={`tab-button ${mode === tab ? "tab-button-active" : ""}`}
              type="button"
              onClick={() => setMode(tab)}
            >
              {tab === "reader" ? "Reader" : tab === "markdown" ? "Markdown" : "Preview"}
            </button>
          ))}
        </nav>
      </div>

      <section className="min-h-0 flex-1 overflow-auto px-5 pb-4">
        {page?.extractionWarning ? (
          <div className="status-note mb-3">
            <AlertTriangle className="mt-0.5 shrink-0" size={16} />
            <div>
              <p className="font-semibold">{page.extractionWarning}</p>
              <p>Select exact text, then reopen the clipper.</p>
            </div>
          </div>
        ) : null}

        {page?.sourceMode === "manualArea" ? (
          <div className="status-note status-note-manual mb-3">
            <MousePointer2 className="mt-0.5 shrink-0" size={16} />
            <div>
              <p className="font-semibold">Manual area</p>
              {page.selectedSelector ? <p className="truncate">{page.selectedSelector}</p> : null}
            </div>
          </div>
        ) : null}

        {loadState.status === "loading" ? (
          <div className="empty-state">
            <RefreshCw className="animate-spin" size={22} />
            <p>{loadState.message}</p>
          </div>
        ) : null}

        {loadState.status === "error" ? (
          <div className="empty-state">
            <FileText size={24} />
            <p>{loadState.message}</p>
          </div>
        ) : null}

        {loadState.status === "ready" && page && !page.markdown.trim() ? (
          <div className="empty-state">
            <FileText size={24} />
            <p>{loadState.message}</p>
          </div>
        ) : null}

        {page && mode === "reader" ? (
          <div className="reader-shell">
            <article
              className="reader-content"
              dangerouslySetInnerHTML={{ __html: page.readerHtml }}
            />
          </div>
        ) : null}

        {page && mode === "markdown" ? (
          <textarea
            className="h-full min-h-[510px] w-full resize-none rounded-lg bg-white p-4 font-mono text-xs leading-5 text-zinc-800 shadow-[0_1px_0_rgba(15,23,42,0.04)] outline-none focus:ring-2 focus:ring-zinc-200"
            value={page.markdown}
            onChange={(event) =>
              setPage({
                ...page,
                markdown: event.target.value
              })
            }
          />
        ) : null}

        {page && mode === "preview" ? (
          <article className="preview-content" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        ) : null}
      </section>

      <footer className="px-5 pb-4 pt-2">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            {shouldShowBackToAuto(page) ? (
              <button
                className="secondary-button"
                type="button"
                onClick={async () => {
                  await clearManualAreaSessionCache(chrome.storage.session);
                  await loadPage({ ignorePendingManualArea: true });
                }}
                disabled={loadState.status === "loading"}
              >
                Back to Auto
              </button>
            ) : null}
            <button
              className="secondary-button"
              type="button"
              onClick={selectArea}
              disabled={loadState.status === "loading"}
            >
              <MousePointer2 size={16} />
              Select Area
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="toolbar-button"
              type="button"
              onClick={copySourceUrl}
              disabled={!page?.url}
              title="Copy Source URL"
            >
              <Link size={16} />
            </button>
            <button
              className="toolbar-button"
              type="button"
              onClick={copyTitle}
              disabled={!page?.title}
              title="Copy Title"
            >
              <Type size={16} />
            </button>
            <button
              className="toolbar-button"
              type="button"
              onClick={downloadCurrentMarkdown}
              disabled={!page?.markdown}
              title="Download Markdown"
            >
              <Download size={16} />
            </button>
            <button className="toolbar-button" type="button" onClick={openIma} title="Open ima">
              <ExternalLink size={16} />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-white p-2 shadow-[0_1px_0_rgba(15,23,42,0.06)]">
          <div className="min-w-0 px-1">
          <a
            className="block min-w-0 truncate text-xs text-zinc-500 hover:text-zinc-800"
            href={page?.url}
            target="_blank"
            rel="noreferrer"
            title={page?.url}
          >
            {page?.url ?? "No page loaded"}
          </a>
          <p className="mt-1 text-xs font-medium text-emerald-700">
            {actionState || "v0.1.0 / Phase 1 Preview / Local-first clipping"}
          </p>
          </div>
          <button
            className={`primary-button ${actionState === "Markdown copied" ? "primary-button-copied" : ""}`}
            type="button"
            onClick={copyMarkdown}
            disabled={!page?.markdown}
          >
            {actionState === "Markdown copied" ? <Check size={17} /> : <Clipboard size={17} />}
            {actionState === "Markdown copied" ? "Copied" : "Copy Markdown"}
          </button>
        </div>
      </footer>
    </main>
  );
}
