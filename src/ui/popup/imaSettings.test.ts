import { describe, expect, it, vi } from "vitest";
import {
  getImaSettings,
  saveImaCredentials,
  saveSelectedKnowledgeBaseId
} from "./imaSettings";

function createStorage(initial: Record<string, unknown> = {}) {
  const data = { ...initial };

  return {
    get: vi.fn(async (key: string) => ({ [key]: data[key] })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(data, items);
    }),
    remove: vi.fn(async (key: string) => {
      delete data[key];
    })
  };
}

describe("ima settings storage", () => {
  it("trims and stores credentials in chrome local storage", async () => {
    const storage = createStorage();

    await saveImaCredentials(
      storage,
      {
        clientId: " client-123 ",
        apiKey: " key-456 "
      }
    );

    expect(storage.set).toHaveBeenCalledWith({
      imaClipperSettings: {
        credentials: {
          clientId: "client-123",
          apiKey: "key-456"
        }
      }
    });
  });

  it("rejects empty credentials", async () => {
    const storage = createStorage();

    await expect(
      saveImaCredentials(storage, {
        clientId: "client-123",
        apiKey: " "
      })
    ).rejects.toThrow("Both ima Client ID and API Key are required.");
  });

  it("stores a selected knowledge base id with existing credentials", async () => {
    const storage = createStorage({
      imaClipperSettings: {
        credentials: {
          clientId: "client-123",
          apiKey: "key-456"
        }
      }
    });

    await saveSelectedKnowledgeBaseId(storage, " kb-1 ");

    expect(await getImaSettings(storage)).toEqual({
      credentials: {
        clientId: "client-123",
        apiKey: "key-456"
      },
      selectedKnowledgeBaseId: "kb-1"
    });
  });
});
