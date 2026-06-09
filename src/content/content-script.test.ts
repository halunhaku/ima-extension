import { afterEach, describe, expect, it, vi } from "vitest";

describe("content script manual area messages", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("notifies the background when the popup response channel is gone", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const addListener = vi.fn();
    const sendMessage = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: {
          addListener
        },
        sendMessage
      }
    });
    document.body.innerHTML = `<main><article id="target"><p>Manual content</p></article></main>`;

    await import("./content-script");

    const listener = addListener.mock.calls[0]?.[0];
    expect(listener).toBeTypeOf("function");
    listener({ type: "IMA_CLIPPER_START_AREA_SELECTION" }, {}, () => {
      throw new Error("The message port closed before a response was received.");
    });

    document.querySelector("#target")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(sendMessage).toHaveBeenCalledWith({
      type: "IMA_CLIPPER_MANUAL_AREA_CAPTURED",
      capture: expect.objectContaining({
        sourceMode: "manualArea",
        selectedText: expect.stringContaining("Manual content")
      })
    });
    expect(warn).toHaveBeenCalledWith(
      "Manual area capture could not respond to the popup.",
      expect.any(Error)
    );
  });
});
