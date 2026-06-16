import { describe, expect, it, vi } from "vitest";
import {
  addNoteToKnowledgeBase,
  importImaMarkdownNote,
  listAddableKnowledgeBases
} from "./imaApi";

const credentials = {
  clientId: "client-123",
  apiKey: "key-456"
};

describe("ima API", () => {
  it("imports markdown as an ima note with OpenAPI credentials", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ code: 0, msg: "success", data: { note_id: "note-1" } }), {
        status: 200
      })
    );

    const result = await importImaMarkdownNote("# Clipped Page", credentials, fetchImpl);

    expect(result.noteId).toBe("note-1");
    expect(fetchImpl).toHaveBeenCalledWith("https://ima.qq.com/openapi/note/v1/import_doc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ima-openapi-apikey": "key-456",
        "ima-openapi-clientid": "client-123"
      },
      body: JSON.stringify({
        content_format: 1,
        content: "# Clipped Page"
      })
    });
  });

  it("adds an imported note to a knowledge base", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ code: 0, msg: "success", data: { media_id: "media-1" } }), {
        status: 200
      })
    );

    const result = await addNoteToKnowledgeBase(
      {
        noteId: "note-1",
        knowledgeBaseId: "kb-1",
        title: "Clipped Page"
      },
      credentials,
      fetchImpl
    );

    expect(result.mediaId).toBe("media-1");
    expect(fetchImpl).toHaveBeenCalledWith("https://ima.qq.com/openapi/wiki/v1/add_knowledge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ima-openapi-apikey": "key-456",
        "ima-openapi-clientid": "client-123"
      },
      body: JSON.stringify({
        media_type: 11,
        note_info: { content_id: "note-1" },
        knowledge_base_id: "kb-1",
        title: "Clipped Page"
      })
    });
  });

  it("lists addable knowledge bases", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          code: 0,
          msg: "success",
          data: {
            addable_knowledge_base_list: [{ id: "kb-1", name: "Inbox" }],
            next_cursor: "",
            is_end: true
          }
        }),
        { status: 200 }
      )
    );

    const result = await listAddableKnowledgeBases(credentials, fetchImpl);

    expect(result).toEqual([{ id: "kb-1", name: "Inbox" }]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://ima.qq.com/openapi/wiki/v1/get_addable_knowledge_base_list",
      expect.objectContaining({
        body: JSON.stringify({ cursor: "", limit: 20 })
      })
    );
  });

  it("surfaces ima API errors", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ code: 20004, msg: "apiKey auth failed" }), { status: 200 })
    );

    await expect(importImaMarkdownNote("# Page", credentials, fetchImpl)).rejects.toThrow(
      "apiKey auth failed"
    );
  });
});
