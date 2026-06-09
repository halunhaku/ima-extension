import { describe, expect, it, vi } from "vitest";
import type { ExtractedPage } from "../../types/capture";
import {
  MANUAL_AREA_SESSION_KEY,
  clearManualAreaSessionCache,
  shouldShowBackToAuto,
  takePendingManualAreaCapture,
  takePendingManualAreaCaptureForUrl
} from "./manualAreaState";

function page(sourceMode: ExtractedPage["sourceMode"]): ExtractedPage {
  return {
    title: "Page",
    url: "https://example.com/post",
    siteName: "example.com",
    byline: "",
    excerpt: "",
    readerHtml: "<p>Body</p>",
    markdown: "Body",
    contentMarkdown: "Body",
    capturedAt: "2026-06-09T00:00:00.000Z",
    sourceMode,
    usedSelection: sourceMode === "selection"
  };
}

describe("manual area popup state", () => {
  it("shows Back to Auto only for manual area captures", () => {
    expect(shouldShowBackToAuto(page("manualArea"))).toBe(true);
    expect(shouldShowBackToAuto(page("auto"))).toBe(false);
    expect(shouldShowBackToAuto(page("fallback"))).toBe(false);
    expect(shouldShowBackToAuto(null)).toBe(false);
  });

  it("takes and clears pending manual area cache for the same URL", async () => {
    const remove = vi.fn(async () => undefined);
    const storage = {
      get: vi.fn(async () => ({
        [MANUAL_AREA_SESSION_KEY]: {
          title: "Manual",
          url: "https://example.com/post",
          html: "<html></html>",
          sourceMode: "manualArea" as const
        }
      })),
      remove
    };

    const capture = await takePendingManualAreaCaptureForUrl(storage, "https://example.com/post");

    expect(capture?.sourceMode).toBe("manualArea");
    expect(remove).toHaveBeenCalledWith(MANUAL_AREA_SESSION_KEY);
  });

  it("does not clear pending manual area cache for a different URL", async () => {
    const remove = vi.fn(async () => undefined);
    const storage = {
      get: vi.fn(async () => ({
        [MANUAL_AREA_SESSION_KEY]: {
          title: "Manual",
          url: "https://example.com/other",
          html: "<html></html>",
          sourceMode: "manualArea" as const
        }
      })),
      remove
    };

    const capture = await takePendingManualAreaCaptureForUrl(storage, "https://example.com/post");

    expect(capture).toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });

  it("clears manual area session cache for Back to Auto", async () => {
    const remove = vi.fn(async () => undefined);
    await clearManualAreaSessionCache({ get: vi.fn(), remove });

    expect(remove).toHaveBeenCalledWith(MANUAL_AREA_SESSION_KEY);
  });

  it("does not throw when clearing manual area cache is denied", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const remove = vi.fn(async () => {
      throw new Error("Access to storage is not allowed from this context.");
    });

    await expect(clearManualAreaSessionCache({ get: vi.fn(), remove })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      "Manual area session storage could not be cleared.",
      expect.any(Error)
    );
  });

  it("takes and clears pending manual area cache without checking the URL", async () => {
    const remove = vi.fn(async () => undefined);
    const storage = {
      get: vi.fn(async () => ({
        [MANUAL_AREA_SESSION_KEY]: {
          title: "Manual",
          url: "https://example.com/post",
          html: "<html></html>",
          sourceMode: "manualArea" as const
        }
      })),
      remove
    };

    const capture = await takePendingManualAreaCapture(storage);

    expect(capture?.sourceMode).toBe("manualArea");
    expect(remove).toHaveBeenCalledWith(MANUAL_AREA_SESSION_KEY);
  });

  it("returns null when reading manual area cache is denied", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const storage = {
      get: vi.fn(async () => {
        throw new Error("Access to storage is not allowed from this context.");
      }),
      remove: vi.fn(async () => undefined)
    };

    await expect(takePendingManualAreaCapture(storage)).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "Manual area session storage could not be read.",
      expect.any(Error)
    );
  });
});
