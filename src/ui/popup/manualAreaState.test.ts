import { describe, expect, it, vi } from "vitest";
import type { ExtractedPage } from "../../types/capture";
import {
  MANUAL_AREA_SESSION_KEY,
  clearManualAreaSessionCache,
  shouldShowBackToAuto,
  retryTakePendingManualAreaCapture,
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

describe("manual area retry recovery", () => {
  it("resolves on the first retry when storage is initially empty", async () => {
    vi.useFakeTimers();
    const remove = vi.fn(async () => undefined);
    const storage = {
      get: vi
        .fn()
        .mockResolvedValueOnce({}) // first read: empty
        .mockResolvedValueOnce({
          // second read: has data
          [MANUAL_AREA_SESSION_KEY]: {
            title: "Manual",
            url: "https://example.com/post",
            html: "<html></html>",
            sourceMode: "manualArea" as const,
            selectedHtml: "<section>Body</section>"
          }
        }),
      remove
    };

    const promise = retryTakePendingManualAreaCapture(storage, 3, 10);
    await vi.advanceTimersByTimeAsync(20);

    const capture = await promise;
    expect(capture?.sourceMode).toBe("manualArea");
    expect(remove).toHaveBeenCalledWith(MANUAL_AREA_SESSION_KEY);
    expect(storage.get).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("returns null after exhausting all retries when storage remains empty", async () => {
    vi.useFakeTimers();
    const storage = {
      get: vi.fn().mockResolvedValue({}),
      remove: vi.fn(async () => undefined)
    };

    const promise = retryTakePendingManualAreaCapture(storage, 3, 10);
    await vi.advanceTimersByTimeAsync(50);

    const capture = await promise;
    expect(capture).toBeNull();
    expect(storage.get).toHaveBeenCalledTimes(4); // initial + 3 retries

    vi.useRealTimers();
  });

  it("returns null if session storage read keeps throwing errors", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const storage = {
      get: vi.fn().mockRejectedValue(new Error("Storage unavailable")),
      remove: vi.fn(async () => undefined)
    };

    const promise = retryTakePendingManualAreaCapture(storage, 2, 10);
    await vi.advanceTimersByTimeAsync(30);

    const capture = await promise;
    expect(capture).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Manual area session storage could not be read"),
      expect.any(Error)
    );

    vi.useRealTimers();
  });

  it("resolves immediately when capture is available on first read", async () => {
    const remove = vi.fn(async () => undefined);
    const storage = {
      get: vi.fn().mockResolvedValue({
        [MANUAL_AREA_SESSION_KEY]: {
          title: "Manual",
          url: "https://example.com/post",
          html: "<html></html>",
          sourceMode: "manualArea" as const,
          selectedHtml: "<section>Body</section>"
        }
      }),
      remove
    };

    const capture = await retryTakePendingManualAreaCapture(storage);
    expect(capture?.sourceMode).toBe("manualArea");
    expect(remove).toHaveBeenCalledWith(MANUAL_AREA_SESSION_KEY);
    expect(storage.get).toHaveBeenCalledTimes(1); // no retries needed
  });
});
