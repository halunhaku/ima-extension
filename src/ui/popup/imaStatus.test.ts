import { describe, expect, it } from "vitest";
import { formatImaSaveButton, formatImaStatusLine } from "./imaStatus";

describe("ima status line", () => {
  it("summarizes connected target and latest save status", () => {
    expect(
      formatImaStatusLine({
        connected: true,
        selectedKnowledgeBaseName: "halunhaku knowledge",
        message: "Saved to ima knowledge base.",
        status: "ready"
      })
    ).toBe("ima connected / halunhaku knowledge / Saved");
  });

  it("shows note-only mode when no knowledge base is selected", () => {
    expect(
      formatImaStatusLine({
        connected: true,
        message: "Saved as ima note.",
        status: "ready"
      })
    ).toBe("ima connected / Note only / Saved");
  });

  it("keeps errors visible in the compact line", () => {
    expect(
      formatImaStatusLine({
        connected: true,
        selectedKnowledgeBaseName: "Inbox",
        message: "apiKey auth failed",
        status: "error"
      })
    ).toBe("ima connected / Inbox / apiKey auth failed");
  });

  it("prompts connection before credentials exist", () => {
    expect(
      formatImaStatusLine({
        connected: false,
        message: "",
        status: "idle"
      })
    ).toBe("Connect ima to save directly");
  });
});

describe("ima save button", () => {
  it("makes successful note saves visible on the primary button", () => {
    expect(
      formatImaSaveButton({
        status: "ready",
        message: "Saved as ima note.",
        connected: true
      })
    ).toEqual({
      label: "Saved",
      tone: "success"
    });
  });

  it("keeps the default save label before a save result exists", () => {
    expect(
      formatImaSaveButton({
        status: "ready",
        message: "ima connected",
        connected: true
      })
    ).toEqual({
      label: "Save to ima",
      tone: "default"
    });
  });

  it("turns errors into an actionable retry label", () => {
    expect(
      formatImaSaveButton({
        status: "error",
        message: "apiKey auth failed",
        connected: true
      })
    ).toEqual({
      label: "Retry save",
      tone: "error"
    });
  });
});
