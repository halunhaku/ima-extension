# Web Clipper for ima Privacy Policy

Last updated: 2026-06-19

Web Clipper for ima is a browser extension for clipping the current web page into Markdown and, when the user chooses, saving that Markdown to Tencent ima.

This extension is not an official Tencent or ima product and is not endorsed by Tencent.

## Data the Extension Handles

The extension handles the following data only to provide clipping and saving features:

- The title, URL, selected text, selected HTML, and readable content of the current page when the user opens the extension or uses Select Area.
- Markdown generated from that page content.
- ima Client ID, ima API Key, and selected knowledge base target entered by the user.
- Temporary manual-area capture data saved in Chrome session storage so the popup can recover a selected area if the popup closes.

## How Data Is Used

Page content is used to generate a readable preview and Markdown export inside the extension popup.

When the user clicks Save to ima, the generated Markdown is sent over HTTPS to Tencent ima OpenAPI endpoints at `https://ima.qq.com/`. If the user selects a knowledge base, the extension also asks ima to add the imported note to that knowledge base.

The extension does not sell user data, does not use user data for advertising, and does not transfer user data to data brokers or information resellers.

## Storage

The extension stores ima connection settings in Chrome local extension storage on the user's device. Manual-area capture recovery data is stored in Chrome session extension storage and is cleared when the user returns to automatic capture or when the browser session expires.

The developer does not operate a separate backend service for this extension.

## Sharing

The extension shares clipped Markdown and related save requests only with Tencent ima when the user explicitly uses the Save to ima feature. The extension does not share data with other third parties.

## Security

Requests to ima are sent over HTTPS. The extension package does not include the user's ima API Key or Client ID. Users can update or remove their ima credentials from the extension settings.

## Limited Use Statement

The use of information received from Chrome extension permissions will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Contact

For privacy questions, use the support contact listed on the Chrome Web Store listing or the project's repository issue tracker.
