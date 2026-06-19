# Web Clipper for ima

A Chrome MV3 web clipper for turning web pages into clean Markdown and saving them to Tencent ima as notes or knowledge-base entries.

![Web Clipper for ima popup](docs/assets/popup-reader.png)

## What It Does

- Extracts readable article content from the current tab.
- Converts captured content to Markdown.
- Lets you review the result in `Reader`, `Markdown`, and `Preview` modes.
- Supports automatic capture, selected text capture, and manual area capture.
- Copies Markdown, copies source URL/title, downloads `.md` files, and opens ima.
- Connects to the ima OpenAPI with a Client ID and API Key.
- Saves captures as ima notes, optionally adding them to a selected knowledge base.

## Capture Modes

The badge next to `ima Clipper` shows where the current capture came from:

- `Auto`: normal automatic page extraction.
- `Selection`: capture from text selected before opening the popup.
- `Manual Area`: capture from an area chosen with `Select Area`.
- `Fallback`: fallback extraction when the page is hard to parse.

## ima Save Flow

1. Open the popup.
2. Click the gear icon in the ima row.
3. Paste your ima Client ID and API Key from `https://ima.qq.com/agent-interface`.
4. Pick `Note only` or a writable knowledge base.
5. Click `Save to ima`.

The extension first imports the Markdown as an ima note. If a knowledge base is selected, it then adds that note to the knowledge base.

## Install Locally

```powershell
npm install
npm run build
```

Then load the extension in Chrome:

1. Open `chrome://extensions/`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the local `dist` folder from this repository.

## Development

```powershell
npm run dev
npm test
npm run build
```

## Package

```powershell
npm run package
```

The packaged extension zip is written to:

```text
releases/web-clipper-for-ima-v0.1.1.zip
```

## Project Structure

```text
src/content/       Content script and manual area selection
src/background/    MV3 service worker and context menu handling
src/core/          Extraction, cleanup, and Markdown template logic
src/ui/popup/      Popup UI, export actions, and ima API integration
docs/              Manual test checklist and implementation notes
scripts/           Packaging helper
```

## Verification

Before packaging or sharing a build, run:

```powershell
npm test
npm run build
npm run package
```

For browser smoke testing, follow [docs/manual-test-checklist.md](docs/manual-test-checklist.md).

## Chrome Web Store Prep

Before submitting to the Chrome Web Store, review:

- [docs/privacy-policy.md](docs/privacy-policy.md)
- [docs/chrome-store-listing.md](docs/chrome-store-listing.md)

The extension package includes local icons under `public/icons`. Store listing screenshots and the 440x280 promotional image are uploaded separately in the Chrome Web Store Developer Dashboard.
