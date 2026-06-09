import { afterEach, describe, expect, it } from "vitest";
import {
  HINT_ID,
  buildManualAreaCapture,
  cancelManualAreaSelection,
  getElementSelector,
  startManualAreaSelection
} from "./manual-area";

describe("manual area capture", () => {
  afterEach(() => {
    cancelManualAreaSelection();
    document.body.innerHTML = "";
    document.getElementById(HINT_ID)?.remove();
  });

  it("builds the manual area message data structure", () => {
    document.body.innerHTML = `
      <main>
        <article id="target">
          <h1>Manual area</h1>
          <p>Selected paragraph.</p>
        </article>
      </main>
    `;
    document.title = "Manual Area Page";
    const element = document.querySelector("#target") as HTMLElement;

    const capture = buildManualAreaCapture(element, "https://example.com/page");

    expect(capture.sourceMode).toBe("manualArea");
    expect(capture.title).toBe("Manual Area Page");
    expect(capture.url).toBe("https://example.com/page");
    expect(capture.selectedHtml).toContain("Selected paragraph.");
    expect(capture.selectedText).toContain("Manual area");
    expect(capture.selectedSelector).toBe("article#target");
    expect(capture.capturedAt).toMatch(/T/);
  });

  it("generates a stable selector for nested elements", () => {
    document.body.innerHTML = `<main><section class="docs"><article><p>Text</p></article></section></main>`;
    const element = document.querySelector("article") as HTMLElement;

    expect(getElementSelector(element)).toBe("main > section.docs > article");
  });

  it("creates and removes the select area hint bar after a click", async () => {
    document.body.innerHTML = `<main><article id="target"><p>Manual content</p></article></main>`;
    const promise = startManualAreaSelection();

    const hint = document.getElementById(HINT_ID);
    expect(hint?.textContent).toContain("Click to clip this area");
    expect(hint?.textContent).toContain("Esc to cancel");

    document.querySelector("#target")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
    const capture = await promise;

    expect(capture?.sourceMode).toBe("manualArea");
    expect(capture?.selectedHtml).toContain("Manual content");
    expect(document.getElementById(HINT_ID)).toBeNull();
  });

  it("cleans up hint and highlight when Esc cancels area selection", async () => {
    document.body.innerHTML = `<main><article id="target"><p>Manual content</p></article></main>`;
    const promise = startManualAreaSelection();

    expect(document.getElementById(HINT_ID)).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const capture = await promise;

    expect(capture).toBeNull();
    expect(document.getElementById(HINT_ID)).toBeNull();
    expect(document.getElementById("ima-clipper-area-highlight")).toBeNull();
  });
});
