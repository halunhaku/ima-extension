# Manual Test Checklist

## Chrome Load

1. Open `chrome://extensions/`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the local `dist` folder from this repository.
5. Confirm `Web Clipper for ima` appears with no load errors.

## Generic Page Capture

1. Open a normal article page.
2. Open the extension popup.
3. Confirm Reader, Markdown, and Preview tabs all show content.
4. Confirm title, source badge, and captured time are visible.

## GitHub README

1. Open a GitHub repository README page.
2. Open the popup.
3. Confirm the README body is captured.
4. Confirm header and navigation noise are absent.
5. Confirm code blocks remain intact in Markdown and Preview.

## MDN And web.dev

1. Open an MDN API documentation page.
2. Confirm TOC and newsletter sections are absent.
3. Confirm code examples remain intact.
4. Open a `web.dev` article.
5. Confirm article content is present and devsite chrome is not mixed in.

## BBC Or News Page

1. Open a BBC or similar news article.
2. Confirm the headline and body paragraphs are captured.
3. Confirm obvious ad slots are absent.
4. Confirm images remain as Markdown image links where present.

## Selection Mode

1. Highlight a paragraph on a page.
2. Open the popup.
3. Confirm the source badge shows `Selection`.
4. Confirm only the selected content is present.

## Select Area

1. Open the popup and click `Select Area`.
2. Confirm the page shows the hint bar: `Click to clip this area · Esc to cancel`.
3. Hover elements and confirm the highlight box follows the target area.
4. Click an article block.
5. Reopen the popup if it closes.
6. Confirm the source badge shows `Manual Area`.
7. Confirm the `Manual area selected` notice is visible.

## Esc Cancel

1. Start `Select Area`.
2. Press `Esc`.
3. Confirm the hint bar disappears.
4. Confirm the highlight box disappears.
5. Confirm the popup remains on the previous extraction state.

## Back To Auto

1. Create a manual area capture.
2. Click `Back to Auto`.
3. Confirm the popup re-runs automatic extraction.
4. Confirm the source badge changes to `Auto` or `Fallback`.

## Copy Actions

1. Click `Copy Markdown` and confirm the success message appears.
2. Click `URL` and confirm the source URL is copied.
3. Click `Title` and confirm the page title is copied.

## Download Markdown

1. Click `MD`.
2. Confirm a `.md` file downloads.
3. Confirm the filename is derived from the clipped title.
4. Confirm the file content includes the title, body Markdown, and source metadata footer.

## Open ima

1. Click `ima`.
2. Confirm a new tab opens to `https://ima.qq.com/`.
3. Confirm no content is auto-injected.

## Connect ima API

1. In the popup, open ima settings.
2. Paste the Client ID and API Key from `https://ima.qq.com/agent-interface`.
3. Click `Save Connection`.
4. Confirm the status changes to `ima connected`.
5. If writable knowledge bases are available, select one from the target menu.
6. Click `Save to ima`.
7. Confirm the status shows either `Saved as ima note.` or `Saved to ima knowledge base.`

## Known Issues

- Record any site-specific extraction noise here.
- Record any popup-close behavior around `Select Area` here.
- Record any filename or download edge cases here.

## Result Window Recovery

1. Open a page, open the popup, and click `Select Area`.
2. Click an element to capture it. Confirm the result appears in the same popup.
3. Close the popup.
4. Reopen the popup on the same page (via toolbar or right-click → "Open Web Clipper for ima").
5. Confirm the popup shows the previously captured manual area result (recovered from session storage).
6. Click `Back to Auto`. Confirm it switches to normal auto capture.

## Result Window — Retry Recovery

1. Open a page, open the popup, and click `Select Area`.
2. Before clicking an element, close the popup (simulating popup close during selection).
3. Click an element on the page — the service worker saves the capture to session storage.
4. Reopen the popup. Confirm it attempts to restore the manual area capture.
5. If restoration succeeds, confirm the source badge shows `Manual Area`.
6. If restoration fails (e.g., session expired), confirm a clear error message appears with:
   - A `Retry` button to re-attempt reading from session storage.
   - A `Back to Auto` button to fall back to automatic page extraction.

## Back To Auto (from Error State)

1. Open the popup with `?source=manualArea` (e.g., by simulating a result window open).
2. If the captured area cannot be restored, confirm the error state shows both `Retry` and `Back to Auto` buttons.
3. Click `Back to Auto`. Confirm the popup re-runs automatic extraction and the source badge shows `Auto` or `Fallback`.
4. Confirm session storage is cleared so future popup opens do not attempt to restore the stale manual area.
