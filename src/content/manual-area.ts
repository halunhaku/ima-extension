import type { RawPageCapture } from "../types/capture";

export const HIGHLIGHT_ID = "ima-clipper-area-highlight";
export const HINT_ID = "ima-clipper-area-hint";
let activeCleanup: (() => void) | null = null;

function cssEscape(value: string): string {
  return globalThis.CSS?.escape
    ? globalThis.CSS.escape(value)
    : value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
}

export function getElementSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase();
    const id = current.id ? `#${cssEscape(current.id)}` : "";
    if (id) {
      parts.unshift(`${tag}${id}`);
      break;
    }
    const classes = Array.from(current.classList)
      .slice(0, 2)
      .map((className) => `.${cssEscape(className)}`)
      .join("");
    parts.unshift(`${tag}${classes}`);
    current = current.parentElement;
  }

  return parts.join(" > ");
}

export function buildManualAreaCapture(element: HTMLElement, url = location.href): RawPageCapture {
  return {
    title: document.title,
    url,
    html: document.documentElement.outerHTML,
    capturedAt: new Date().toISOString(),
    sourceMode: "manualArea",
    selectedHtml: element.innerHTML,
    selectedText: element.innerText || element.textContent || "",
    selectedSelector: getElementSelector(element)
  };
}

function ensureHighlight(): HTMLDivElement {
  const existing = document.getElementById(HIGHLIGHT_ID) as HTMLDivElement | null;
  if (existing) {
    return existing;
  }

  const highlight = document.createElement("div");
  highlight.id = HIGHLIGHT_ID;
  Object.assign(highlight.style, {
    position: "fixed",
    zIndex: "2147483647",
    pointerEvents: "none",
    border: "2px solid #047857",
    background: "rgba(4, 120, 87, 0.10)",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.85), 0 8px 28px rgba(15,23,42,0.18)",
    borderRadius: "4px",
    transition: "all 80ms ease"
  });
  document.documentElement.append(highlight);
  return highlight;
}

function updateHighlight(element: Element): void {
  const rect = element.getBoundingClientRect();
  const highlight = ensureHighlight();
  Object.assign(highlight.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
  });
}

function removeHighlight(): void {
  document.getElementById(HIGHLIGHT_ID)?.remove();
}

function ensureHint(): HTMLDivElement {
  const existing = document.getElementById(HINT_ID) as HTMLDivElement | null;
  if (existing) {
    return existing;
  }

  const hint = document.createElement("div");
  hint.id = HINT_ID;
  hint.textContent = "Click to clip this area · Esc to cancel";
  Object.assign(hint.style, {
    position: "fixed",
    top: "12px",
    right: "12px",
    zIndex: "2147483647",
    pointerEvents: "none",
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid rgba(4, 120, 87, 0.35)",
    background: "rgba(255, 255, 255, 0.96)",
    color: "#064e3b",
    boxShadow: "0 8px 28px rgba(15, 23, 42, 0.18)",
    font: "13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  });
  document.documentElement.append(hint);
  return hint;
}

function removeHint(): void {
  document.getElementById(HINT_ID)?.remove();
}

export function cancelManualAreaSelection(): void {
  activeCleanup?.();
}

export function startManualAreaSelection(): Promise<RawPageCapture | null> {
  if (activeCleanup) {
    activeCleanup();
  }

  return new Promise((resolve) => {
    let settled = false;

    function finish(capture: RawPageCapture | null): void {
      if (settled) {
        return;
      }
      settled = true;
      activeCleanup?.();
      resolve(capture);
    }

    function onMouseMove(event: MouseEvent): void {
      const target = event.target;
      if (target instanceof Element && target.id !== HIGHLIGHT_ID) {
        updateHighlight(target);
      }
    }

    function onClick(event: MouseEvent): void {
      event.preventDefault();
      event.stopPropagation();
      const target = event.target;
      finish(target instanceof HTMLElement ? buildManualAreaCapture(target) : null);
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finish(null);
      }
    }

    activeCleanup = () => {
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      removeHighlight();
      removeHint();
      activeCleanup = null;
    };

    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    ensureHighlight();
    ensureHint();
  });
}
