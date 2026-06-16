import type { ExtractedPage, RawPageCapture } from "../../types/capture";

export interface ManualAreaSessionStorage {
  get(key: string): Promise<Record<string, unknown>>;
  remove(key: string): Promise<void>;
}

export const MANUAL_AREA_SESSION_KEY = "imaClipperLastManualAreaCapture";

async function readManualAreaSession(
  storage: ManualAreaSessionStorage
): Promise<RawPageCapture | null> {
  try {
    const stored = await storage.get(MANUAL_AREA_SESSION_KEY);
    const capture = stored[MANUAL_AREA_SESSION_KEY] as RawPageCapture | undefined;
    if (!capture || capture.sourceMode !== "manualArea") {
      return null;
    }

    return capture;
  } catch (error) {
    console.warn("Manual area session storage could not be read.", error);
    return null;
  }
}

async function removeManualAreaSession(storage: ManualAreaSessionStorage): Promise<void> {
  try {
    await storage.remove(MANUAL_AREA_SESSION_KEY);
  } catch (error) {
    console.warn("Manual area session storage could not be cleared.", error);
  }
}

export function shouldShowBackToAuto(page: ExtractedPage | null): boolean {
  return page?.sourceMode === "manualArea";
}

export async function takePendingManualAreaCaptureForUrl(
  storage: ManualAreaSessionStorage,
  url: string
): Promise<RawPageCapture | null> {
  const capture = await readManualAreaSession(storage);
  if (!capture || capture.url !== url) {
    return null;
  }

  await removeManualAreaSession(storage);
  return capture;
}

export async function takePendingManualAreaCapture(
  storage: ManualAreaSessionStorage
): Promise<RawPageCapture | null> {
  const capture = await readManualAreaSession(storage);
  if (!capture) {
    return null;
  }

  await removeManualAreaSession(storage);
  return capture;
}

export async function clearManualAreaSessionCache(storage: ManualAreaSessionStorage): Promise<void> {
  await removeManualAreaSession(storage);
}

const DEFAULT_RETRY_MAX = 5;
const DEFAULT_RETRY_DELAY_MS = 80;

/**
 * Read and remove a pending manual area capture from session storage,
 * retrying up to `maxRetries` times with `delayMs` between attempts.
 *
 * This handles the race condition where the service worker may not have
 * finished writing to session storage by the time the result popup reads it.
 *
 * Returns the capture if found, or `null` after exhausting all retries.
 */
export async function retryTakePendingManualAreaCapture(
  storage: ManualAreaSessionStorage,
  maxRetries = DEFAULT_RETRY_MAX,
  delayMs = DEFAULT_RETRY_DELAY_MS
): Promise<RawPageCapture | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const capture = await takePendingManualAreaCapture(storage);
    if (capture) {
      return capture;
    }

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return null;
}
