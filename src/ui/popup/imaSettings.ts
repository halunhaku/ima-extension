import type { ImaCredentials } from "./imaApi";

export interface ImaSettings {
  credentials?: ImaCredentials;
  selectedKnowledgeBaseId?: string;
}

interface LocalStorageLike {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export const IMA_SETTINGS_STORAGE_KEY = "imaClipperSettings";

export async function getImaSettings(storage: LocalStorageLike): Promise<ImaSettings> {
  const result = await storage.get(IMA_SETTINGS_STORAGE_KEY);
  const settings = result[IMA_SETTINGS_STORAGE_KEY];
  if (!settings || typeof settings !== "object") {
    return {};
  }

  return settings as ImaSettings;
}

export async function saveImaCredentials(
  storage: LocalStorageLike,
  credentials: ImaCredentials
): Promise<ImaSettings> {
  const clientId = credentials.clientId.trim();
  const apiKey = credentials.apiKey.trim();

  if (!clientId || !apiKey) {
    throw new Error("Both ima Client ID and API Key are required.");
  }

  const nextSettings: ImaSettings = {
    ...(await getImaSettings(storage)),
    credentials: {
      clientId,
      apiKey
    }
  };

  await storage.set({ [IMA_SETTINGS_STORAGE_KEY]: nextSettings });
  return nextSettings;
}

export async function saveSelectedKnowledgeBaseId(
  storage: LocalStorageLike,
  knowledgeBaseId: string
): Promise<ImaSettings> {
  const selectedKnowledgeBaseId = knowledgeBaseId.trim();
  const current = await getImaSettings(storage);
  const nextSettings: ImaSettings = {
    ...current,
    selectedKnowledgeBaseId: selectedKnowledgeBaseId || undefined
  };

  await storage.set({ [IMA_SETTINGS_STORAGE_KEY]: nextSettings });
  return nextSettings;
}

export async function clearImaSettings(storage: LocalStorageLike): Promise<void> {
  await storage.remove(IMA_SETTINGS_STORAGE_KEY);
}
