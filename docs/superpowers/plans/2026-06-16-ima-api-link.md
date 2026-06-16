# ima API Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal, local-first ima OpenAPI connection to save the current clipped Markdown as an ima note and optionally add it to a selected knowledge base.

**Architecture:** Keep API transport and Chrome storage in small tested modules under `src/ui/popup/`. `PopupApp` owns UI state and calls those modules; credentials stay in `chrome.storage.local` and are never hard-coded.

**Tech Stack:** Chrome MV3, React, TypeScript, Vitest, ima OpenAPI endpoints under `https://ima.qq.com/openapi`.

---

### Task 1: API And Storage Modules

**Files:**
- Create: `src/ui/popup/imaApi.ts`
- Create: `src/ui/popup/imaApi.test.ts`
- Create: `src/ui/popup/imaSettings.ts`
- Create: `src/ui/popup/imaSettings.test.ts`

- [ ] Write failing tests for `import_doc` request shape and credential storage validation.
- [ ] Run targeted tests and confirm they fail because modules are missing.
- [ ] Implement minimal API/storage modules.
- [ ] Run targeted tests and confirm they pass.

### Task 2: Popup Integration

**Files:**
- Modify: `src/ui/popup/PopupApp.tsx`
- Modify: `src/ui/popup/popup.css`
- Modify: `manifest.json`
- Modify: `docs/manual-test-checklist.md`

- [ ] Add UI state for credentials, addable knowledge bases, selected target, and save status.
- [ ] Add controls for connecting ima, refreshing knowledge bases, and saving current Markdown.
- [ ] Use `importImaMarkdownNote`, then `addNoteToKnowledgeBase` when a target knowledge base is selected.
- [ ] Add `https://ima.qq.com/*` host permission explicitly.
- [ ] Document manual setup and smoke testing.

### Task 3: Verification

**Files:**
- Package and test outputs only.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Report exact verification results and any manual steps left for real credentials.
