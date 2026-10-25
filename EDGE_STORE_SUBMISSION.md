# Microsoft Edge Add-ons submission

Web Clipper for ima ships the same extension ZIP to Chrome and Edge. Store submission is manual: the release workflow only builds the ZIP and attaches it to the GitHub Release.

## Manual upload

1. Push the `vX.Y.Z` tag and wait for the `Release` workflow to finish.
2. Download `web-clipper-for-ima-X.Y.Z.zip` from the GitHub Release for that tag.
3. In [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge), open the product, upload the ZIP to the existing submission, and submit it.

No Edge credentials belong in the repository or in GitHub Actions secrets.

## Release behavior

A `vX.Y.Z` tag builds one deterministic ZIP for Chrome and Edge and attaches it to the public GitHub Release. Nothing is uploaded to Partner Center automatically, and certification remains asynchronous.

Partner Center owns the initial product creation and any listing metadata changes.

## Retry

If the workflow failed, fix the failure and rerun **Actions → Release → Run workflow** with the same tag; the rerun refreshes the Release asset when the tag already has one. A failed store upload is retried by uploading the ZIP again from Partner Center.

Official documentation: <https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api>
