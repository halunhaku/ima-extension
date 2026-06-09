import type { RawPageCapture } from "../../types/capture";
import {
  takePendingManualAreaCapture,
  takePendingManualAreaCaptureForUrl,
  type ManualAreaSessionStorage
} from "./manualAreaState";

interface ResolvePreferredCaptureOptions {
  captureActivePage: () => Promise<RawPageCapture>;
  storage: ManualAreaSessionStorage;
  ignorePendingManualArea?: boolean;
}

export async function resolvePreferredCapture({
  captureActivePage,
  storage,
  ignorePendingManualArea
}: ResolvePreferredCaptureOptions): Promise<RawPageCapture> {
  try {
    const activeCapture = await captureActivePage();
    if (ignorePendingManualArea) {
      return activeCapture;
    }

    const pendingManualArea = await takePendingManualAreaCaptureForUrl(storage, activeCapture.url);
    return pendingManualArea ?? activeCapture;
  } catch (error) {
    if (!ignorePendingManualArea) {
      const pendingManualArea = await takePendingManualAreaCapture(storage);
      if (pendingManualArea) {
        return pendingManualArea;
      }
    }

    throw error;
  }
}
