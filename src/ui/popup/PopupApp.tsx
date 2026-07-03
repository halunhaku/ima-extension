import {
  AlertTriangle,
  Check,
  Clipboard,
  Database,
  Download,
  ExternalLink,
  FileText,
  Link,
  MousePointer2,
  RefreshCw,
  Send,
  Settings,
  Type
} from "lucide-react";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { extractPage } from "../../core/extraction/extractPage";
import type { ExtractedPage, RawPageCapture } from "../../types/capture";
import { downloadMarkdown } from "./exportActions";
import {
  addNoteToKnowledgeBase,
  importImaMarkdownNote,
  listAddableKnowledgeBases,
  type ImaCredentials,
  type ImaKnowledgeBaseOption
} from "./imaApi";
import {
  getImaSettings,
  saveImaCredentials,
  saveSelectedKnowledgeBaseId,
  type ImaSettings
} from "./imaSettings";
import { formatImaSaveButton, formatImaStatusLine } from "./imaStatus";
import { renderMarkdownPreview } from "./markdownPreview";
import {
  clearManualAreaSessionCache,
  retryTakePendingManualAreaCapture,
  shouldShowBackToAuto,
  takePendingManualAreaCapture
} from "./manualAreaState";
import { getTargetTab } from "./activeTab";
import { resolvePreferredCapture } from "./popupCapture";

type ViewMode = "reader" | "markdown" | "preview";

interface LoadState {
  status: "idle" | "loading" | "ready" | "error";
  message: string;
}

interface ImaState {
  status: "idle" | "loading" | "ready" | "error";
  message: string;
}

async function captureActivePage(): Promise<RawPageCapture> {
  const tab = await getTargetTab();

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
  const tab = await getTargetTab();

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
  // Use actual window height so standalone popups (manual area result)
  // fill the available space instead of leaving dead space at the bottom.
  const [popupHeight] = useState(() => Math.max(window.innerHeight, 600));
  const [actionState, setActionState] = useState<string>("");
  const [loadState, setLoadState] = useState<LoadState>({
    status: "idle",
    message: ""
  });
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [imaSettings, setImaSettings] = useState<ImaSettings>({});
  const [knowledgeBases, setKnowledgeBases] = useState<ImaKnowledgeBaseOption[]>([]);
  const [imaState, setImaState] = useState<ImaState>({ status: "idle", message: "" });
  const [showImaSettings, setShowImaSettings] = useState(false);
  const [clientIdInput, setClientIdInput] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState("");
  const [recentAction, setRecentAction] = useState<"copy" | "save" | null>(null);

  const previewHtml = useMemo(() => renderMarkdownPreview(page?.markdown ?? ""), [page?.markdown]);
  const markdownWordCount = useMemo(() => {
    const text = page?.markdown.replace(/[#>*`_[\]\-]/g, " ").trim() ?? "";
    if (!text) {
      return 0;
    }
    return text.split(/\s+/).length;
  }, [page?.markdown]);
  const readerImageCount = useMemo(() => {
    if (!page?.readerHtml) {
      return 0;
    }
    return (page.readerHtml.match(/<img\b/gi) ?? []).length;
  }, [page?.readerHtml]);
  const selectedKnowledgeBaseName = useMemo(
    () =>
      knowledgeBases.find((knowledgeBase) => knowledgeBase.id === selectedKnowledgeBaseId)?.name,
    [knowledgeBases, selectedKnowledgeBaseId]
  );
  const imaStatusLine = formatImaStatusLine({
    connected: Boolean(imaSettings.credentials),
    selectedKnowledgeBaseName,
    message: imaState.message,
    status: imaState.status
  });
  const imaSaveButton = formatImaSaveButton({
    connected: Boolean(imaSettings.credentials),
    message: imaState.message,
    status: imaState.status
  });
  const tabs: ViewMode[] = ["reader", "markdown", "preview"];

  async function refreshKnowledgeBases(credentials: ImaCredentials) {
    setImaState({ status: "loading", message: "Loading ima targets..." });
    const options = await listAddableKnowledgeBases(credentials);
    setKnowledgeBases(options);
    setImaState({
      status: "ready",
      message: options.length ? "ima connected" : "ima connected; no writable knowledge bases found."
    });
    return options;
  }

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
    const params = new URLSearchParams(window.location.search);
    const isResultWindow = params.get("source") === "manualArea";

    if (isResultWindow) {
      setIsRecoveryMode(true);
      setLoadState({
        status: "loading",
        message: "Restoring captured area..."
      });
      void retryTakePendingManualAreaCapture(chrome.storage.session).then((capture) => {
        if (capture) {
          const extracted = extractPage(capture);
          setPage(extracted);
          setLoadState({
            status: "ready",
            message: extracted.markdown.trim() ? "" : "No readable content found."
          });
        } else {
          setLoadState({
            status: "error",
            message:
              "Captured area could not be restored. The session data may have expired or was unavailable. You can retry or capture the current page automatically."
          });
        }
      });
    } else {
      void loadPage();
    }
  }, [loadPage]);

  useEffect(() => {
    void getImaSettings(chrome.storage.local).then((settings) => {
      setImaSettings(settings);
      setClientIdInput(settings.credentials?.clientId ?? "");
      setSelectedKnowledgeBaseId(settings.selectedKnowledgeBaseId ?? "");
      if (settings.credentials) {
        setShowImaSettings(false);
        void refreshKnowledgeBases(settings.credentials).catch((error) => {
          setImaState({
            status: "error",
            message: error instanceof Error ? error.message : "ima connection failed."
          });
        });
      } else {
        setShowImaSettings(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!recentAction) {
      return undefined;
    }

    const timer = window.setTimeout(() => setRecentAction(null), 1800);
    return () => window.clearTimeout(timer);
  }, [recentAction]);

  async function copyMarkdown() {
    if (!page?.markdown) {
      return;
    }

    await navigator.clipboard.writeText(page.markdown);
    setActionState("Markdown copied");
    setRecentAction("copy");
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

  async function connectIma() {
    try {
      const settings = await saveImaCredentials(chrome.storage.local, {
        clientId: clientIdInput,
        apiKey: apiKeyInput
      });
      setImaSettings(settings);
      setApiKeyInput("");
      const options = await refreshKnowledgeBases(settings.credentials as ImaCredentials);
      const storedTarget = settings.selectedKnowledgeBaseId;
      if (storedTarget && options.some((option) => option.id === storedTarget)) {
        setSelectedKnowledgeBaseId(storedTarget);
      }
      setShowImaSettings(false);
    } catch (error) {
      setImaState({
        status: "error",
        message: error instanceof Error ? error.message : "ima connection failed."
      });
    }
  }

  async function chooseKnowledgeBase(knowledgeBaseId: string) {
    setSelectedKnowledgeBaseId(knowledgeBaseId);
    const settings = await saveSelectedKnowledgeBaseId(chrome.storage.local, knowledgeBaseId);
    setImaSettings(settings);
  }

  async function saveCurrentPageToIma() {
    if (!page?.markdown.trim() || !imaSettings.credentials) {
      setShowImaSettings(true);
      setImaState({
        status: "error",
        message: imaSettings.credentials ? "No Markdown content to save." : "Connect ima first."
      });
      return;
    }

    try {
      setImaState({ status: "loading", message: "Saving to ima..." });
      const imported = await importImaMarkdownNote(page.markdown, imaSettings.credentials);
      if (selectedKnowledgeBaseId) {
        await addNoteToKnowledgeBase(
          {
            noteId: imported.noteId,
            knowledgeBaseId: selectedKnowledgeBaseId,
            title: page.title
          },
          imaSettings.credentials
        );
      }
      setImaState({
        status: "ready",
        message: selectedKnowledgeBaseId ? "Saved to ima knowledge base." : "Saved as ima note."
      });
      setRecentAction("save");
    } catch (error) {
      setImaState({
        status: "error",
        message: error instanceof Error ? error.message : "Save to ima failed."
      });
    }
  }

  async function showCaptureResult(capture: RawPageCapture) {
    try {
      const extracted = extractPage(capture);
      setPage(extracted);
      setLoadState({
        status: "ready",
        message:
          extracted.markdown.trim()
            ? ""
            : "No readable content was found in the selected area."
      });
    } catch (error) {
      setPage(null);
      setLoadState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Selected area could not be extracted."
      });
    }
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
        return;
      }
      // Display the captured area result immediately in this popup,
      // without relying on the background opening a new result window.
      await showCaptureResult(capture);
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

  function handleTabKeyDown(currentTab: ViewMode, event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }

    event.preventDefault();

    const currentIndex = tabs.indexOf(currentTab);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    }

    const nextTab = tabs[nextIndex];
    setMode(nextTab);
    window.requestAnimationFrame(() => {
      document.getElementById(`${nextTab}-tab`)?.focus();
    });
  }

  return (
    <main className="flex w-[560px] overflow-hidden bg-[#f7f7f4] text-zinc-950" style={{ height: popupHeight }}>
      <div className="flex min-h-0 w-full flex-col">
        <header className="shrink-0 px-5 pb-3 pt-4">
        <div className="panel-shell px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-zinc-500">
                <span className="brand-mark">
                  <span className="brand-dot" aria-hidden="true" />
                  ima Clipper
                </span>
                {page ? <span className={sourceModeClass(page)}>{sourceModeLabel(page)}</span> : null}
              </div>
              <h1 className="mt-2 line-clamp-1 text-balance text-[18px] font-semibold leading-6 text-zinc-950">
                {page?.title ?? "Current page"}
              </h1>
            </div>
            <button
              className="icon-button bg-white/80"
              type="button"
              title="Refresh capture"
              aria-label="Refresh capture"
              onClick={() => void loadPage()}
              disabled={loadState.status === "loading"}
            >
              <RefreshCw className={loadState.status === "loading" ? "animate-spin motion-reduce:animate-none" : ""} size={16} />
            </button>
          </div>
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span className="meta-pill max-w-full truncate">{page?.siteName ?? "No page loaded"}</span>
            {page ? (
              <span className="meta-pill shrink-0">
                {new Date(page.capturedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </span>
            ) : null}
            {page && markdownWordCount > 0 ? (
              <span className="meta-pill shrink-0">{markdownWordCount} words</span>
            ) : null}
            {page && readerImageCount > 0 ? (
              <span className="meta-pill shrink-0">{readerImageCount} images</span>
            ) : null}
            {page?.siteRuleApplied ? <span className="site-rule-badge">{page.siteRuleApplied}</span> : null}
          </div>
          <div className="accent-divider mt-4" />
        </div>
        </header>

        <div className="shrink-0 px-5 pb-2">
        <nav
          className="grid grid-cols-3 gap-1 rounded-xl bg-[#f1efe8] p-1"
          aria-label="View mode"
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`tab-button ${mode === tab ? "tab-button-active" : ""}`}
              type="button"
              id={`${tab}-tab`}
              role="tab"
              aria-selected={mode === tab}
              aria-controls={`${tab}-panel`}
              onClick={() => setMode(tab)}
              onKeyDown={(event) => handleTabKeyDown(tab, event)}
            >
              {tab === "reader" ? "Reader" : tab === "markdown" ? "Markdown" : "Preview"}
            </button>
          ))}
        </nav>
        </div>

        <section className="min-h-0 flex-1 overflow-hidden px-5 pb-3">
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
          <div className="empty-state" aria-live="polite">
            <RefreshCw className="animate-spin motion-reduce:animate-none" size={22} />
            <p>{loadState.message}</p>
          </div>
        ) : null}

        {loadState.status === "error" ? (
          <div className="empty-state" aria-live="polite">
            <FileText size={24} />
            <p>{loadState.message}</p>
            {isRecoveryMode ? (
              <div className="mt-4 flex gap-2">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setLoadState({ status: "loading", message: "Retrying..." });
                    void retryTakePendingManualAreaCapture(chrome.storage.session, 8, 100).then(
                      (capture) => {
                        if (capture) {
                          const extracted = extractPage(capture);
                          setPage(extracted);
                          setLoadState({
                            status: "ready",
                            message: extracted.markdown.trim() ? "" : "No readable content found."
                          });
                        } else {
                          setLoadState({
                            status: "error",
                            message:
                              "Captured area could not be restored. The session may have expired."
                          });
                        }
                      }
                    );
                  }}
                  disabled={false}
                >
                  <RefreshCw size={16} />
                  Retry
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={async () => {
                    setIsRecoveryMode(false);
                    await clearManualAreaSessionCache(chrome.storage.session);
                    await loadPage({ ignorePendingManualArea: true });
                  }}
                  disabled={false}
                >
                  Back to Auto
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {loadState.status === "ready" && page && !page.markdown.trim() ? (
          <div className="empty-state" aria-live="polite">
            <FileText size={24} />
            <p>{loadState.message}</p>
          </div>
        ) : null}

        {page && mode === "reader" ? (
          <div
            className="reader-shell content-surface"
            id="reader-panel"
            role="tabpanel"
            aria-labelledby="reader-tab"
          >
            <article
              className="reader-content"
              dangerouslySetInnerHTML={{ __html: page.readerHtml }}
            />
          </div>
        ) : null}

        {page && mode === "markdown" ? (
          <div
            className="content-surface h-full rounded-xl border border-white/80 bg-white p-3 shadow-[0_14px_40px_rgba(15,23,42,0.06)]"
            id="markdown-panel"
            role="tabpanel"
            aria-labelledby="markdown-tab"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="section-label">Editable Markdown</p>
              <p className="supporting-copy">{markdownWordCount > 0 ? `${markdownWordCount} words ready to refine` : "Start editing the capture"}</p>
            </div>
            <textarea
              aria-label="Markdown content"
              className="h-[calc(100%-30px)] min-h-0 w-full resize-none overflow-auto rounded-lg bg-[#fbfaf7] p-4 font-mono text-xs leading-5 text-zinc-800 outline-none focus:ring-2 focus:ring-zinc-200"
              value={page.markdown}
              onChange={(event) =>
                setPage({
                  ...page,
                  markdown: event.target.value
                })
              }
            />
          </div>
        ) : null}

        {page && mode === "preview" ? (
          <article
            className="preview-content content-surface"
            id="preview-panel"
            role="tabpanel"
            aria-labelledby="preview-tab"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : null}
        </section>

        <footer className="shrink-0 px-5 pb-3 pt-2">
        <div className="ima-panel ima-panel-compact mb-3">
          <div className="ima-action-row">
            <div className="ima-status-line">
              <span className="status-icon-chip shrink-0" aria-hidden="true">
                <Database size={15} />
              </span>
              <div className="min-w-0">
                <p
                  className={`truncate text-xs font-semibold ${
                    imaState.status === "error" ? "text-red-700" : "text-zinc-800"
                  }`}
                  title={imaStatusLine}
                >
                  {imaStatusLine}
                </p>
              </div>
            </div>

            {imaSettings.credentials ? (
              <select
                className="ima-select ima-select-compact"
                value={selectedKnowledgeBaseId}
                onChange={(event) => void chooseKnowledgeBase(event.target.value)}
                disabled={imaState.status === "loading"}
                title="ima target"
                aria-label="ima target"
              >
                <option value="">Note only</option>
                {knowledgeBases.map((knowledgeBase) => (
                  <option key={knowledgeBase.id} value={knowledgeBase.id}>
                    {knowledgeBase.name}
                  </option>
                ))}
              </select>
            ) : null}

            {imaSettings.credentials ? (
              <button
                className="toolbar-button"
                type="button"
                title="Refresh ima targets"
                aria-label="Refresh ima targets"
                onClick={() =>
                  imaSettings.credentials
                    ? void refreshKnowledgeBases(imaSettings.credentials)
                    : undefined
                }
                disabled={imaState.status === "loading"}
              >
                <RefreshCw size={15} />
              </button>
            ) : null}

            <button
              className={`primary-button ima-save-button ${
                imaSaveButton.tone === "success"
                  ? "ima-save-button-success"
                  : imaSaveButton.tone === "error"
                    ? "ima-save-button-error"
                    : ""
              } ${recentAction === "save" ? "action-pulse" : ""}`}
              type="button"
              onClick={() => void saveCurrentPageToIma()}
              disabled={!page?.markdown || imaState.status === "loading"}
              title={imaSettings.credentials ? "Save to ima" : "Connect ima first"}
              aria-label={imaSettings.credentials ? "Save to ima" : "Connect ima first"}
            >
              {imaSaveButton.tone === "success" ? <Check size={15} /> : <Send size={15} />}
              {imaSaveButton.label}
            </button>

            <button
              className="toolbar-button"
              type="button"
              title="ima settings"
              aria-label="Open ima settings"
              onClick={() => setShowImaSettings((value) => !value)}
            >
              <Settings size={16} />
            </button>
          </div>

          {showImaSettings ? (
            <div className="mt-3 grid gap-2 border-t border-zinc-100 pt-3">
              <label className="settings-field">
                <span className="settings-label">ima Client ID</span>
                <input
                  className="ima-input"
                  type="text"
                  value={clientIdInput}
                  onChange={(event) => setClientIdInput(event.target.value)}
                  placeholder="Paste Client ID…"
                  autoComplete="off"
                  aria-label="ima Client ID"
                />
              </label>
              <label className="settings-field">
                <span className="settings-label">ima API Key</span>
                <input
                  className="ima-input"
                  type="password"
                  value={apiKeyInput}
                  onChange={(event) => setApiKeyInput(event.target.value)}
                  placeholder={imaSettings.credentials ? "Paste API Key to update…" : "Paste API Key…"}
                  autoComplete="off"
                  aria-label="ima API Key"
                />
              </label>
              <button
                className="secondary-button justify-self-start"
                type="button"
                onClick={() => void connectIma()}
                disabled={imaState.status === "loading"}
              >
                Save Connection
              </button>
            </div>
          ) : null}
        </div>
        <div className="action-tray">
          <div className="action-tray-group">
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
          <div className="action-tray-group">
            <button
              className={`primary-button compact-primary-button ${
                actionState === "Markdown copied" ? "primary-button-copied" : ""
              } ${recentAction === "copy" ? "action-pulse" : ""}`}
              type="button"
              onClick={copyMarkdown}
              disabled={!page?.markdown}
              title="Copy Markdown"
            >
              {actionState === "Markdown copied" ? <Check size={16} /> : <Clipboard size={16} />}
              {actionState === "Markdown copied" ? "Copied" : "Copy"}
            </button>
            <button
              className="toolbar-button toolbar-button-subtle"
              type="button"
              onClick={copySourceUrl}
              disabled={!page?.url}
              title="Copy URL"
              aria-label="Copy URL"
            >
              <Link size={16} />
            </button>
            <button
              className="toolbar-button toolbar-button-subtle"
              type="button"
              onClick={copyTitle}
              disabled={!page?.title}
              title="Copy Title"
              aria-label="Copy title"
            >
              <Type size={16} />
            </button>
            <button
              className="toolbar-button toolbar-button-subtle"
              type="button"
              onClick={downloadCurrentMarkdown}
              disabled={!page?.markdown}
              title="Download Markdown"
              aria-label="Download Markdown"
            >
              <Download size={16} />
            </button>
            <button
              className="toolbar-button toolbar-button-subtle"
              type="button"
              onClick={openIma}
              title="Open ima"
              aria-label="Open ima"
            >
              <ExternalLink size={16} />
            </button>
          </div>
        </div>
        <div className="sr-only" aria-live="polite">
          {actionState || imaState.message}
        </div>
        </footer>
      </div>
    </main>
  );
}
