# Chrome Web Store Listing Draft

Use this file as source copy for the Chrome Web Store Developer Dashboard.

## Single Purpose

Web Clipper for ima clips the current web page, selected text, or a manually selected page area into clean Markdown so the user can review, copy, download, or save it to Tencent ima.

## Short Description

Clip web pages into clean Markdown and save them to Tencent ima.

## Detailed Description

Web Clipper for ima helps knowledge workers capture useful web pages into Tencent ima.

Core features:

- Extract readable page content from the active tab.
- Capture selected text or a manually selected page area.
- Review the result in Reader, Markdown, or Preview mode.
- Copy Markdown, copy the source URL or title, and download a Markdown file.
- Connect to ima with a user-provided Client ID and API Key.
- Save Markdown as an ima note and optionally add it to a selected ima knowledge base.

This extension is not an official Tencent or ima product and is not endorsed by Tencent.

## Category

Productivity

## Permission Justifications

`activeTab`: Used when the user opens the extension or chooses the context menu action so the extension can read the active page for clipping.

`scripting`: Used to inject the local content script into the active tab only after the user invokes the extension. The content script captures page content or starts manual area selection.

`storage`: Used to save user-provided ima connection settings locally and to temporarily recover manual area captures.

`contextMenus`: Used to add an "Open Web Clipper for ima" menu item for page and selection clipping.

`https://ima.qq.com/*`: Used to call Tencent ima OpenAPI endpoints when the user saves Markdown to ima or loads writable knowledge base targets.

## Privacy Practices Notes

Data handled:

- Website content and resources: current page title, URL, readable HTML, selected text, selected HTML, and generated Markdown.
- Authentication information: user-provided ima Client ID and API Key, stored locally in Chrome extension storage.
- User-generated content: Markdown edited or saved by the user.

Data use:

- Provide page clipping, Markdown preview/export, and user-initiated save-to-ima behavior.
- No advertising use.
- No sale of data.
- No transfer to data brokers.
- No separate developer backend.

Privacy policy URL:

- Publish `docs/privacy-policy.md` as a public web page and paste that URL into the Developer Dashboard privacy policy field.

## Test Instructions for Review

1. Install the uploaded extension package.
2. Open a normal article page.
3. Click the extension icon.
4. Confirm the Reader, Markdown, and Preview tabs show clipped content.
5. Select text on the page, reopen the extension, and confirm the Selection badge appears.
6. Click Select Area, choose a page section, and confirm the Manual Area badge appears.
7. Use Copy Markdown, URL, Title, and MD download actions.
8. Click ima to confirm `https://ima.qq.com/` opens.
9. To test Save to ima, enter valid ima Client ID and API Key from `https://ima.qq.com/agent-interface`, then click Save to ima.

If valid ima credentials are not available to the reviewer, the clipping, preview, copy, download, and Open ima flows can still be tested without credentials.

## Required Assets

- Extension icon: included in the package at `icons/icon-128.png`.
- Small promotional image: upload `docs/store-assets/promo-small-440x280.png`.
- Screenshots:
  - `docs/store-assets/screenshots/01-reader-capture-1280x800.png`
  - `docs/store-assets/screenshots/02-manual-area-1280x800.png`
  - `docs/store-assets/screenshots/03-save-to-ima-1280x800.png`
