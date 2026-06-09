import type { RawPageCapture } from "../types/capture";
import { startManualAreaSelection } from "./manual-area";

function getSelectedHtml(): string {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.toString().trim().length === 0) {
    return "";
  }

  const container = document.createElement("div");
  for (let index = 0; index < selection.rangeCount; index += 1) {
    container.append(selection.getRangeAt(index).cloneContents());
  }
  return container.innerHTML;
}

function capturePage(): RawPageCapture {
  const selection = window.getSelection()?.toString().trim() ?? "";
  const selectedHtml = getSelectedHtml();

  return {
    title: document.title,
    url: location.href,
    html: document.documentElement.outerHTML,
    capturedAt: new Date().toISOString(),
    sourceMode: selectedHtml ? "selection" : "auto",
    selectedHtml,
    selectedText: selection
  };
}

function notifyManualAreaCaptured(capture: RawPageCapture): void {
  try {
    void Promise.resolve(
      chrome.runtime.sendMessage({ type: "IMA_CLIPPER_MANUAL_AREA_CAPTURED", capture })
    ).catch((error) => {
      console.warn("Manual area capture could not notify the background worker.", error);
    });
  } catch (error) {
    console.warn("Manual area capture could not notify the background worker.", error);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "IMA_CLIPPER_CAPTURE_PAGE") {
    sendResponse(capturePage());
    return true;
  }

  if (message?.type === "IMA_CLIPPER_START_AREA_SELECTION") {
    startManualAreaSelection().then((capture) => {
      if (capture) {
        notifyManualAreaCaptured(capture);
      }
      try {
        sendResponse({ canceled: !capture, capture });
      } catch (error) {
        console.warn("Manual area capture could not respond to the popup.", error);
      }
    });
    return true;
  }

  return false;
});
