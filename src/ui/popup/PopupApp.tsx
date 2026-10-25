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
  shouldShowBackToAuto
} from "./manualAreaState";
import { getTargetTab } from "./activeTab";
import { resolvePreferredCapture } from "./popupCapture";

type ViewMode = "reader" | "markdown" | "preview";
type ConfirmedAction = "url" | "title" | "download";

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
    return "mode-chip mode-chip-manual";
  }
  if (page.sourceMode === "selection") {
    return "mode-chip mode-chip-selection";
  }
  if (page.sourceMode === "fallback") {
    return "mode-chip mode-chip-fallback";
  }
  return "mode-chip";
}

function imaStatusMarkClass(status: ImaState["status"], connected: boolean): string {
  if (!connected) {
    return "status-mark";
  }
  if (status === "error") {
    return "status-mark status-mark-error";
  }
  if (status === "ready") {
    return "status-mark status-mark-ok";
  }
  return "status-mark";
}

export function PopupApp() {
  const [page, setPage] = useState<ExtractedPage | null>(null);
  const [mode, setMode] = useState<ViewMode>("reader");
  // Use actual window height so standalone popups (manual area result)
  // fill the available space instead of leaving dead space at the bottom.
  const [popupHeight] = useState(() => Math.max(window.innerHeight, 600));
  const [actionState, setActionState] = useState<string>("");
  const [confirmedAction, setConfirmedAction] = useState<ConfirmedAction | null>(null);
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
  const markdownCopied = actionState === "Markdown copied";
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
    if (!confirmedAction) {
      return undefined;
    }

    const timer = window.setTimeout(() => setConfirmedAction(null), 1400);
    return () => window.clearTimeout(timer);
  }, [confirmedAction]);

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
    setConfirmedAction("url");
    window.setTimeout(() => setActionState(""), 1600);
  }

  async function copyTitle() {
    if (!page?.title) {
      return;
    }

    await navigator.clipboard.writeText(page.title);
    setActionState("Title copied");
    setConfirmedAction("title");
    window.setTimeout(() => setActionState(""), 1600);
  }

  function downloadCurrentMarkdown() {
    if (!page?.markdown) {
      return;
    }

    downloadMarkdown(page.markdown, page.title);
    setActionState("Markdown downloaded");
    setConfirmedAction("download");
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
    <main className="popup-app" style={{ height: popupHeight }}>
      <header className="popup-head">
        <div className="popup-brand-row">
          <span className="brand">
            <span className="brand-name">ima Clipper</span>
            <span className="brand-cap">web clipper</span>
          </span>
          <button
            className="icon-button icon-button-tip-below"
            type="button"
            data-tip="Refresh capture"
            aria-label="Refresh capture"
            onClick={() => void loadPage()}
            disabled={loadState.status === "loading"}
          >
            <RefreshCw className={loadState.status === "loading" ? "is-spinning" : ""} size={14} />
          </button>
        </div>
        <h1 className="page-title">{page?.title ?? "Current page"}</h1>
        <div className="meta-row">
          <span className="meta-main">
            {page?.siteName ?? "No page loaded"}
            {page ? (
              <>
                <span className="meta-sep">·</span>
                {new Date(page.capturedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </>
            ) : null}
            {page && markdownWordCount > 0 ? (
              <>
                <span className="meta-sep">·</span>
                {markdownWordCount} words
              </>
            ) : null}
            {page && readerImageCount > 0 ? (
              <>
                <span className="meta-sep">·</span>
                {readerImageCount} images
              </>
            ) : null}
          </span>
          <span className="meta-chips">
            {page?.siteRuleApplied ? (
              <span className="mode-chip mode-chip-site">{page.siteRuleApplied}</span>
            ) : null}
            {page ? <span className={sourceModeClass(page)}>{sourceModeLabel(page)}</span> : null}
          </span>
        </div>
      </header>

      <nav className="view-tabs" aria-label="View mode" role="tablist">
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

      <section className="popup-body">
        {page?.extractionWarning ? (
          <div className="status-note status-note-warning">
            <AlertTriangle size={14} aria-hidden="true" />
            <div className="min-w-0">
              <p className="status-note-title">{page.extractionWarning}</p>
              <p className="status-note-hint">Select exact text, then reopen the clipper.</p>
            </div>
          </div>
        ) : null}

        {page?.sourceMode === "manualArea" ? (
          <div className="status-note">
            <MousePointer2 size={14} aria-hidden="true" />
            <div className="min-w-0">
              <p className="status-note-title">Manual area</p>
              {page.selectedSelector ? (
                <p className="status-note-hint">{page.selectedSelector}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {loadState.status === "loading" ? (
          <div className="empty-state" aria-live="polite">
            <RefreshCw className="is-spinning" size={22} aria-hidden="true" />
            <p className="empty-state-message">{loadState.message}</p>
          </div>
        ) : null}

        {loadState.status === "error" ? (
          <div className="empty-state" aria-live="polite">
            <FileText size={22} aria-hidden="true" />
            <p className="empty-state-message">{loadState.message}</p>
            {isRecoveryMode ? (
              <div className="empty-state-actions">
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
                  <RefreshCw size={14} />
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
            <FileText size={22} aria-hidden="true" />
            <p className="empty-state-message">{loadState.message}</p>
          </div>
        ) : null}

        {page && mode === "reader" ? (
          <div className="reader-shell" id="reader-panel" role="tabpanel" aria-labelledby="reader-tab">
            <article
              className="reader-content"
              dangerouslySetInnerHTML={{ __html: page.readerHtml }}
            />
          </div>
        ) : null}

        {page && mode === "markdown" ? (
          <div
            className="markdown-shell"
            id="markdown-panel"
            role="tabpanel"
            aria-labelledby="markdown-tab"
          >
            <div className="section-row">
              <p className="section-label">Editable Markdown</p>
              <p className="supporting-copy">
                {markdownWordCount > 0
                  ? `${markdownWordCount} words ready to refine`
                  : "Start editing the capture"}
              </p>
            </div>
            <textarea
              aria-label="Markdown content"
              className="markdown-input"
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
          <div className="reader-shell" id="preview-panel" role="tabpanel" aria-labelledby="preview-tab">
            <article className="reader-content" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        ) : null}
      </section>

      <footer className="popup-foot">
        <div className="ima-panel">
          <div className="ima-status-line">
            <span
              className={imaStatusMarkClass(imaState.status, Boolean(imaSettings.credentials))}
              aria-hidden="true"
            />
            <p
              className={`status-text ${imaState.status === "error" ? "status-text-error" : ""}`}
              title={imaStatusLine}
            >
              {imaStatusLine}
            </p>
            <button
              className="icon-button"
              type="button"
              data-tip="ima settings"
              aria-label="Open ima settings"
              aria-expanded={showImaSettings}
              onClick={() => setShowImaSettings((value) => !value)}
            >
              <Settings size={14} />
            </button>
          </div>

          {imaSettings.credentials ? (
            <div className="ima-target-row">
              <span className="select-wrap">
                <select
                  className="ima-select"
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
              </span>
              <button
                className="icon-button"
                type="button"
                data-tip="Refresh ima targets"
                aria-label="Refresh ima targets"
                onClick={() =>
                  imaSettings.credentials
                    ? void refreshKnowledgeBases(imaSettings.credentials)
                    : undefined
                }
                disabled={imaState.status === "loading"}
              >
                <RefreshCw size={14} className={imaState.status === "loading" ? "is-spinning" : ""} />
              </button>
            </div>
          ) : null}

          <button
            className={`primary-button ima-save-button ${
              imaSaveButton.tone === "success"
                ? "ima-save-button-success"
                : imaSaveButton.tone === "error"
                  ? "ima-save-button-error"
                  : ""
            }`}
            type="button"
            onClick={() => void saveCurrentPageToIma()}
            disabled={!page?.markdown || imaState.status === "loading"}
            title={imaSettings.credentials ? "Save to ima" : "Connect ima first"}
            aria-label={imaSettings.credentials ? "Save to ima" : "Connect ima first"}
          >
            {imaSaveButton.tone === "success" ? <Check size={14} /> : <Send size={14} />}
            {imaSaveButton.label}
          </button>

          {showImaSettings ? (
            <div className="settings-grid">
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
                className="secondary-button settings-submit"
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
              <MousePointer2 size={14} />
              Select Area
            </button>
          </div>
          <div className="action-tray-group">
            <button
              className={`outline-button ${markdownCopied ? "is-copied" : ""}`}
              type="button"
              onClick={copyMarkdown}
              disabled={!page?.markdown}
              title="Copy Markdown"
            >
              {markdownCopied ? <Check size={14} /> : <Clipboard size={14} />}
              {markdownCopied ? "Copied" : "Copy"}
            </button>
            <button
              className={`icon-button ${confirmedAction === "url" ? "is-confirmed" : ""}`}
              type="button"
              onClick={copySourceUrl}
              disabled={!page?.url}
              data-tip="Copy URL"
              aria-label="Copy URL"
            >
              {confirmedAction === "url" ? <Check size={14} /> : <Link size={14} />}
            </button>
            <button
              className={`icon-button ${confirmedAction === "title" ? "is-confirmed" : ""}`}
              type="button"
              onClick={copyTitle}
              disabled={!page?.title}
              data-tip="Copy Title"
              aria-label="Copy title"
            >
              {confirmedAction === "title" ? <Check size={14} /> : <Type size={14} />}
            </button>
            <button
              className={`icon-button ${confirmedAction === "download" ? "is-confirmed" : ""}`}
              type="button"
              onClick={downloadCurrentMarkdown}
              disabled={!page?.markdown}
              data-tip="Download Markdown"
              aria-label="Download Markdown"
            >
              {confirmedAction === "download" ? <Check size={14} /> : <Download size={14} />}
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={openIma}
              data-tip="Open ima"
              aria-label="Open ima"
            >
              <ExternalLink size={14} />
            </button>
          </div>
        </div>
        <div className="sr-only" aria-live="polite">
          {actionState || imaState.message}
        </div>
      </footer>
    </main>
  );
}
