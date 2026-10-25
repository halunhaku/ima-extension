# Release Smoke Checklist

## Local automation smoke

1. Run `npm test`.
2. Run `npm run validate`.
3. Run `npm run package`.
4. Confirm `dist/web-clipper-for-ima-<version>.zip` exists.
5. Inspect the ZIP contents and confirm it contains only extension runtime files from `dist/`.
6. Confirm `.github/workflows/release.yml` only triggers on `v*` tags or manual retry.

## Extension smoke

1. Open `chrome://extensions/`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the local `dist/` folder.
5. Confirm the extension loads without manifest errors.
6. Open a normal article page and confirm the popup can capture content.
7. Confirm `Copy Markdown`, `Title`, `URL`, download, and `ima` actions still work.

## Automation readiness smoke

1. Confirm `.github/workflows/release.yml` holds no store credentials and no store submission steps.
2. Confirm the tag to be released matches `package.json` and `manifest.json`.
3. Confirm the release workflow still uploads `dist/web-clipper-for-ima-<version>.zip` to the public GitHub Release.
4. Confirm the workflow creates the Release only after tests, validation, and packaging pass.

## First live release guardrail

Do not create the first production tag until the local automation smoke passes and both store listings already exist.
