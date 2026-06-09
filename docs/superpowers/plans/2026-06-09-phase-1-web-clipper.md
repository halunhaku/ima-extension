# Phase 1 Web Clipper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome MV3 extension that extracts the current page, converts it to Markdown, shows a reader/preview UI, and copies Markdown.

**Architecture:** A content script reads the active page DOM and selected text, the popup asks the active tab for capture data, and shared core modules normalize HTML into Markdown. The popup is a React/Tailwind app with Reader, Markdown source, and Preview tabs.

**Tech Stack:** Chrome MV3, TypeScript, React, Tailwind, Vite, Mozilla Readability, Turndown, Vitest.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `src/vite-env.d.ts`

- [ ] Add dependencies and scripts for build, tests, and typechecking.
- [ ] Configure Vite to emit popup, content script, and service worker assets into `dist`.

### Task 2: Extension Shell

**Files:**
- Create: `manifest.json`
- Create: `src/background/service-worker.ts`
- Create: `src/content/content-script.ts`
- Create: `src/types/capture.ts`

- [ ] Define MV3 permissions: `activeTab`, `scripting`, `storage`, and `contextMenus`.
- [ ] Add a content script that returns title, URL, selection, and full document HTML.
- [ ] Add a minimal service worker.

### Task 3: Extraction Pipeline

**Files:**
- Create: `src/core/extraction/extractPage.test.ts`
- Create: `src/core/extraction/extractPage.ts`

- [ ] Write failing tests for article extraction, selected text priority, metadata preservation, and fallback behavior.
- [ ] Implement Readability + Turndown conversion.
- [ ] Run `npm test` until all extraction tests pass.

### Task 4: Popup UI

**Files:**
- Create: `src/ui/popup/main.tsx`
- Create: `src/ui/popup/PopupApp.tsx`
- Create: `src/ui/popup/popup.css`
- Create: `src/ui/popup/markdownPreview.ts`

- [ ] Build a React popup with current page metadata, Reader tab, Markdown tab, and Preview tab.
- [ ] Add Copy Markdown and Refresh buttons.
- [ ] Show clear empty/error states.

### Task 5: Styling and Verification

**Files:**
- Create: `postcss.config.js`
- Create: `tailwind.config.js`
- Modify: `src/ui/popup/popup.css`

- [ ] Add Tailwind styling.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Inspect `dist/manifest.json` and generated assets.

### Scope Lock

Phase 1 intentionally excludes AI, ima API, template editor, multiple knowledge bases, and queueing.
