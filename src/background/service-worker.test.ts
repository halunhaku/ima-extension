import { describe, expect, it, vi } from "vitest";
import { handleRuntimeMessage, registerServiceWorker } from "./service-worker";

describe("service worker runtime messages", () => {
  it("opens a dedicated clip window after a manual area capture succeeds", async () => {
    const create = vi.fn(async () => undefined);
    const getURL = vi.fn((path: string) => `chrome-extension://test/${path}`);
    const set = vi.fn(async () => undefined);
    const capture = {
      title: "Manual",
      url: "https://example.com/article",
      html: "<html></html>",
      sourceMode: "manualArea" as const,
      selectedHtml: "<section>Body</section>",
      selectedText: "Body"
    };
    const result = await handleRuntimeMessage(
      { type: "IMA_CLIPPER_MANUAL_AREA_CAPTURED", capture },
      { runtime: { getURL }, windows: { create }, storage: { session: { set } } }
    );

    expect(result).toBe(true);
    expect(set).toHaveBeenCalledWith({ imaClipperLastManualAreaCapture: capture });
    expect(getURL).toHaveBeenCalledWith("index.html?source=manualArea");
    expect(create).toHaveBeenCalledWith({
      url: "chrome-extension://test/index.html?source=manualArea",
      type: "popup",
      focused: true,
      width: 560,
      height: 760
    });
  });

  it("still opens a dedicated clip window if session storage rejects", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const create = vi.fn(async () => undefined);
    const getURL = vi.fn((path: string) => `chrome-extension://test/${path}`);
    const set = vi.fn(async () => {
      throw new Error("Access to storage is not allowed from this context.");
    });
    const capture = {
      title: "Manual",
      url: "https://example.com/article",
      html: "<html></html>",
      sourceMode: "manualArea" as const,
      selectedHtml: "<section>Body</section>",
      selectedText: "Body"
    };
    const result = await handleRuntimeMessage(
      { type: "IMA_CLIPPER_MANUAL_AREA_CAPTURED", capture },
      { runtime: { getURL }, windows: { create }, storage: { session: { set } } }
    );

    expect(result).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      "Manual area capture could not be saved to session storage.",
      expect.any(Error)
    );
    expect(create).toHaveBeenCalledWith({
      url: "chrome-extension://test/index.html?source=manualArea",
      type: "popup",
      focused: true,
      width: 560,
      height: 760
    });
  });

  it("ignores unrelated messages", async () => {
    const create = vi.fn(async () => undefined);
    const result = await handleRuntimeMessage({ type: "OTHER" }, { windows: { create } });

    expect(result).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("handles window creation failure gracefully", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const create = vi.fn(async () => {
      throw new Error("Extension context invalidated.");
    });
    const getURL = vi.fn((path) => `chrome-extension://test/${path}`);
    const set = vi.fn(async () => undefined);
    const capture = {
      title: "Manual",
      url: "https://example.com/article",
      html: "<html></html>",
      sourceMode: "manualArea" as const,
      selectedHtml: "<section>Body</section>",
      selectedText: "Body"
    };
    const result = await handleRuntimeMessage(
      { type: "IMA_CLIPPER_MANUAL_AREA_CAPTURED", capture },
      { runtime: { getURL }, windows: { create }, storage: { session: { set } } }
    );

    expect(result).toBe(true);
    expect(set).toHaveBeenCalledWith({ imaClipperLastManualAreaCapture: capture });
    expect(warn).toHaveBeenCalledWith(
      "Result popup could not be opened; capture is saved in session storage.",
      expect.any(Error)
    );
  });
});

describe("service worker context menu", () => {
  it("opens the clipper popup when the context menu item is clicked", () => {
    const onInstalledListener = vi.fn();
    const onClickedListener = vi.fn();
    const createMenu = vi.fn();
    const createWindow = vi.fn();
    const getURL = vi.fn((path: string) => `chrome-extension://test/${path}`);

    registerServiceWorker({
      contextMenus: {
        create: createMenu,
        onClicked: {
          addListener: onClickedListener
        }
      },
      runtime: {
        getURL,
        onInstalled: {
          addListener: onInstalledListener
        }
      },
      windows: {
        create: createWindow
      }
    });

    const listener = onClickedListener.mock.calls[0]?.[0];
    expect(listener).toBeTypeOf("function");

    listener({ menuItemId: "copy-page-markdown" });

    expect(getURL).toHaveBeenCalledWith("index.html");
    expect(createWindow).toHaveBeenCalledWith({
      url: "chrome-extension://test/index.html",
      type: "popup",
      focused: true,
      width: 560,
      height: 760
    });
  });
});

  it("saves to session storage even when runtime.getURL is unavailable", async () => {
    const set = vi.fn(async () => undefined);
    const capture = {
      title: "Manual",
      url: "https://example.com/article",
      html: "<html></html>",
      sourceMode: "manualArea" as const,
      selectedHtml: "<section>Body</section>",
      selectedText: "Body"
    };
    const result = await handleRuntimeMessage(
      { type: "IMA_CLIPPER_MANUAL_AREA_CAPTURED", capture },
      { storage: { session: { set } } }
    );

    expect(result).toBe(true);
    expect(set).toHaveBeenCalledWith({ imaClipperLastManualAreaCapture: capture });
  });
