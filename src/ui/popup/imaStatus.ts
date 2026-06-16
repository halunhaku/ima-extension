export type ImaStatusKind = "idle" | "loading" | "ready" | "error";

export interface ImaStatusLineInput {
  connected: boolean;
  selectedKnowledgeBaseName?: string;
  message: string;
  status: ImaStatusKind;
}

export interface ImaSaveButtonState {
  connected: boolean;
  message: string;
  status: ImaStatusKind;
}

function saveSummary(message: string): string {
  if (message === "Saved to ima knowledge base." || message === "Saved as ima note.") {
    return "Saved";
  }
  return message;
}

function isSavedMessage(message: string): boolean {
  return message === "Saved to ima knowledge base." || message === "Saved as ima note.";
}

export function formatImaStatusLine(input: ImaStatusLineInput): string {
  if (!input.connected) {
    return "Connect ima to save directly";
  }

  const target = input.selectedKnowledgeBaseName || "Note only";
  const detail =
    input.status === "idle" || !input.message ? "Ready" : saveSummary(input.message);

  return `ima connected / ${target} / ${detail}`;
}

export function formatImaSaveButton(
  input: ImaSaveButtonState
): { label: string; tone: "default" | "success" | "error" } {
  if (input.status === "loading") {
    return { label: "Saving", tone: "default" };
  }

  if (input.status === "error") {
    return { label: "Retry save", tone: "error" };
  }

  if (input.connected && isSavedMessage(input.message)) {
    return { label: "Saved", tone: "success" };
  }

  return { label: "Save to ima", tone: "default" };
}
