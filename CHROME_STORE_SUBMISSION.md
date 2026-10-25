# Chrome Web Store Submission Notes

## Product summary

- Item name: `Web Clipper for ima`
- Single purpose: convert the current web page into cleaner Markdown for user-controlled review, copying, downloading, and manual handoff into ima
- Category suggestion: Productivity

## Suggested listing copy

### Short description

Capture the current page as clean Markdown for copying, downloading, or handoff into ima.

### Detailed description

Web Clipper for ima extracts the current page into cleaner Markdown directly in the browser. It supports full-page capture, text selection capture, and manual area capture so the user can keep only the content they want.

The extension shows the extracted result in a popup with Markdown and preview views. From there, the user can copy Markdown, copy the title or source URL, download a `.md` file, or open `https://ima.qq.com/` for a manual next step.

The extension processes page content locally. It does not run remote code, does not auto-submit captured content to ima, and does not rely on a developer backend.

## Permissions justification

| Permission | Why it is needed | What breaks without it |
| --- | --- | --- |
| `activeTab` | Read and capture the current active page when the user opens the clipper. | The popup cannot capture the current tab content. |
| `contextMenus` | Add the right-click entry that opens the clipper from a page or selection. | The context-menu entry disappears. |
| `scripting` | Support user-triggered page capture helpers and manual area interactions. | Selection and manual-area flows become unreliable or impossible. |
| `storage` | Keep temporary manual-area capture data in `chrome.storage.session`. | The popup cannot recover the last manual-area capture cleanly. |
| `host_permissions: <all_urls>` | The clipper must work on arbitrary pages the user chooses to capture. | The extension would only work on a narrow allowlist instead of the user's chosen pages. |

## Privacy answers

- Does the extension sell user data: No
- Does the extension use data for personalized ads: No
- Does the extension send page content to the developer: No
- Does the extension run remote code: No
- Does the extension collect browsing history for analytics: No
- Does the extension open an external site: Yes, only when the user explicitly chooses the ima action, which opens `https://ima.qq.com/`

Supporting policy: [PRIVACY_POLICY.md](/Users/halunhaku/projects/ima-extension/PRIVACY_POLICY.md)

## Release automation

The repository release workflow is in `.github/workflows/release.yml`. It builds and publishes the GitHub Release only; it holds no store credentials and never calls a store API.

Release boundary:

- Tag format: `vX.Y.Z`
- `package.json` and `manifest.json` must already match that version before the tag is pushed

Normal release:

1. Run `npm test`
2. Run `npm run validate`
3. Run `npm run package`
4. Commit the versioned files
5. Push tag `vX.Y.Z`
6. Let GitHub Actions run the tests and validation, then create the public Release with `web-clipper-for-ima-X.Y.Z.zip` attached

## Manual Chrome Web Store upload

1. Open the GitHub Release for `vX.Y.Z` and download `web-clipper-for-ima-X.Y.Z.zip`.
2. In the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), open the `Web Clipper for ima` item and upload the ZIP under **Package → Upload new package**.
3. Paste the listing copy above and submit the item for review.

## Retry

If the workflow failed, fix the failure and rerun the workflow for the same tag; the rerun refreshes the Release asset when the tag already has one. A failed store upload is retried by uploading the ZIP again from the dashboard.

## Smoke checklist

Use [docs/release-smoke-checklist.md](/Users/halunhaku/projects/ima-extension/docs/release-smoke-checklist.md) before the first live store submission and after any release-automation changes.
