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
