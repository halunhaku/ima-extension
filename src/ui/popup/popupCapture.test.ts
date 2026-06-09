import { describe, expect, it, vi } from "vitest";
import { resolvePreferredCapture } from "./popupCapture";

describe("popup capture resolution", () => {
  it("uses pending manual area capture when active tab capture is unavailable", async () => {
    const remove = vi.fn(async () => undefined);
    const capture = await resolvePreferredCapture({
      captureActivePage: vi.fn(async () => {
        throw new Error("No page capture available");
      }),
      storage: {
        get: vi.fn(async () => ({
          imaClipperLastManualAreaCapture: {
            title: "Manual area",
            url: "https://example.com/article",
            html: "<html></html>",
            sourceMode: "manualArea" as const,
            selectedHtml: "<section>Body</section>",
            selectedText: "Body"
          }
        })),
        remove
      }
    });

    expect(capture.sourceMode).toBe("manualArea");
    expect(remove).toHaveBeenCalledWith("imaClipperLastManualAreaCapture");
  });

  it("prefers the active tab capture when no pending manual area matches", async () => {
    const activeCapture = {
      title: "Page",
      url: "https://example.com/page",
      html: "<html></html>",
      sourceMode: "auto" as const
    };

    const capture = await resolvePreferredCapture({
      captureActivePage: vi.fn(async () => activeCapture),
      storage: {
        get: vi.fn(async () => ({
          imaClipperLastManualAreaCapture: {
            title: "Other",
            url: "https://example.com/other",
            html: "<html></html>",
            sourceMode: "manualArea" as const
          }
        })),
        remove: vi.fn(async () => undefined)
      }
    });

    expect(capture).toEqual(activeCapture);
  });

  it("uses the active tab capture when session storage is denied", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const activeCapture = {
      title: "Page",
      url: "https://example.com/page",
      html: "<html></html>",
      sourceMode: "auto" as const
    };

    const capture = await resolvePreferredCapture({
      captureActivePage: vi.fn(async () => activeCapture),
      storage: {
        get: vi.fn(async () => {
          throw new Error("Access to storage is not allowed from this context.");
        }),
        remove: vi.fn(async () => undefined)
      }
    });

    expect(capture).toEqual(activeCapture);
    expect(warn).toHaveBeenCalledWith(
      "Manual area session storage could not be read.",
      expect.any(Error)
    );
  });
});
