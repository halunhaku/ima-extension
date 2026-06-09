# Manual Test Checklist

## Chrome Load

1. Open `chrome://extensions/`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select `D:\projects\ima-extension\dist`.
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
4. Confirm the file content includes frontmatter and body Markdown.

## Open ima

1. Click `ima`.
2. Confirm a new tab opens to `https://ima.qq.com/`.
3. Confirm no content is auto-injected.

## Known Issues

- Record any site-specific extraction noise here.
- Record any popup-close behavior around `Select Area` here.
- Record any filename or download edge cases here.
