# Privacy Policy

Last updated: July 2, 2026

## Summary

Web Clipper for ima is designed to process page content locally in the browser so the user can review, copy, or download Markdown derived from the current page.

## What the extension accesses

- `activeTab`: reads the currently active page only when the user runs the clipper.
- `contextMenus`: provides the right-click entry that opens the clipper.
- `scripting`: supports user-triggered capture helpers in the active tab.
- `storage`: stores short-lived manual area capture state in extension session storage.
- `host_permissions: <all_urls>`: allows the content script to operate on pages the user chooses to clip.

## What data is processed

- The page URL and title.
- The visible page HTML needed to extract readable content.
- User-selected text or user-selected page areas when the user uses those capture modes.
- Temporary session state for the last manual area capture.

## What the extension does not do

- It does not run remotely hosted executable code.
- It does not sell user data.
- It does not use advertising SDKs.
- It does not send captured page content to the developer's servers.
- It does not auto-submit captured content to ima or any other remote service.

## Network behavior

- The extension can open `https://ima.qq.com/` in a new tab when the user clicks the ima action.
- Opening that site is a user-initiated navigation only.
- Captured Markdown stays local unless the user manually copies, downloads, or pastes it elsewhere.

## Storage

- The extension uses `chrome.storage.session` for temporary manual area capture state.
- Session storage is not intended as a long-term archive and is cleared by the browser session lifecycle.

## Retention

- Temporary manual area capture state is retained only as long as the browser session keeps that session-scoped storage.
- Downloaded Markdown files are saved only when the user explicitly chooses download.
- Clipboard writes happen only when the user explicitly chooses a copy action.

## Changes

If the extension's permissions, data handling, or publication flow changes, this policy should be updated before the next tagged release.
