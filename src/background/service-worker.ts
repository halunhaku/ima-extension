interface ServiceWorkerChromeLike {
  storage?: {
    session?: {
      set?: (items: Record<string, unknown>) => Promise<unknown> | unknown;
    };
  };
  windows?: {
    create?: (options: {
      url: string;
      type: "popup";
      focused: boolean;
      width: number;
      height: number;
    }) => Promise<unknown> | unknown;
  };
  contextMenus?: {
    create: (options: { id: string; title: string; contexts: Array<string> | string }) => unknown;
    onClicked?: {
      addListener: (
        listener: (info: { menuItemId: string | number }, tab?: chrome.tabs.Tab) => void
      ) => void;
    };
  };
  runtime?: {
    getURL?: (path: string) => string;
    onInstalled?: {
      addListener: (listener: () => void) => void;
    };
    onMessage?: {
      addListener: (
        listener: (
          message: unknown,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response?: unknown) => void
        ) => boolean | void
      ) => void;
    };
  };
}

async function openClipperPopup(runtimeChrome: ServiceWorkerChromeLike, url: string): Promise<void> {
  try {
    await runtimeChrome.windows?.create?.({
      url,
      type: "popup",
      focused: true,
      width: 560,
      height: 760
    });
  } catch (error) {
    console.warn("Result popup could not be opened; capture is saved in session storage.", error);
  }
}

export async function handleRuntimeMessage(
  message: unknown,
  runtimeChrome: ServiceWorkerChromeLike
): Promise<boolean> {
  if ((message as { type?: string })?.type !== "IMA_CLIPPER_MANUAL_AREA_CAPTURED") {
    return false;
  }

  const capture = (message as { capture?: unknown }).capture;
  if (capture) {
    try {
      await runtimeChrome.storage?.session?.set?.({
        imaClipperLastManualAreaCapture: capture
      });
    } catch (error) {
      console.warn("Manual area capture could not be saved to session storage.", error);
    }
  }

  const clipUrl = runtimeChrome.runtime?.getURL?.("index.html?source=manualArea");
  if (clipUrl) {
    await openClipperPopup(runtimeChrome, clipUrl);
  }

  return true;
}

export function registerServiceWorker(runtimeChrome: ServiceWorkerChromeLike): void {
  runtimeChrome.runtime?.onInstalled?.addListener(() => {
    runtimeChrome.contextMenus?.create({
      id: "copy-page-markdown",
      title: "Open Web Clipper for ima",
      contexts: ["page", "selection"]
    });
  });

  runtimeChrome.contextMenus?.onClicked?.addListener((info, tab) => {
    if (info.menuItemId !== "copy-page-markdown") {
      return;
    }

    const clipUrl = runtimeChrome.runtime?.getURL?.(
      tab?.id ? `index.html?tabId=${tab.id}` : "index.html"
    );
    if (clipUrl) {
      void openClipperPopup(runtimeChrome, clipUrl);
    }
  });

  runtimeChrome.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
    void handleRuntimeMessage(message, runtimeChrome).then((handled) => {
      sendResponse({ handled });
    });
    return true;
  });
}

if (typeof chrome !== "undefined") {
  registerServiceWorker(chrome as unknown as ServiceWorkerChromeLike);
}
