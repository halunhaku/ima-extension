import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "package.json",
  "manifest.json",
  "README.md",
  "PRIVACY_POLICY.md",
  "CHROME_STORE_SUBMISSION.md",
  ".github/workflows/release.yml",
  "scripts/release-version.mjs",
  "scripts/package-release.mjs",
  "scripts/cws-api.mjs",
  "scripts/cws-publish.mjs",
  "scripts/cws-auth.mjs"
];

const expectedPermissions = ["activeTab", "contextMenus", "scripting", "storage"];
const expectedHostPermissions = ["<all_urls>"];
const expectedContentScript = {
  matches: ["<all_urls>"],
  js: ["assets/content.js"],
  run_at: "document_idle"
};

async function exists(file) {
  try {
    await access(path.join(root, file), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(path.join(root, file), "utf8"));
}

function sameSortedValues(left = [], right = []) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

const errors = [];

for (const file of requiredFiles) {
  if (!(await exists(file))) {
    errors.push(`Missing required file: ${file}`);
  }
}

let pkg;
let manifest;

try {
  pkg = await readJson("package.json");
} catch (error) {
  errors.push(`package.json is not valid JSON: ${error.message}`);
}

try {
  manifest = await readJson("manifest.json");
} catch (error) {
  errors.push(`manifest.json is not valid JSON: ${error.message}`);
}

if (pkg && manifest) {
  if (pkg.version !== manifest.version) {
    errors.push(
      `package.json version (${pkg.version}) must match manifest.json version (${manifest.version}).`
    );
  }
}

if (manifest) {
  if (manifest.manifest_version !== 3) {
    errors.push("manifest_version must stay at 3.");
  }

  if (manifest.action?.default_popup !== "index.html") {
    errors.push("action.default_popup must stay at index.html.");
  }

  if (manifest.background?.service_worker !== "assets/serviceWorker.js") {
    errors.push("background.service_worker must stay at assets/serviceWorker.js.");
  }

  if (manifest.background?.type !== "module") {
    errors.push("background.type must stay at module.");
  }

  if (!sameSortedValues(manifest.permissions, expectedPermissions)) {
    errors.push(
      `permissions changed. Expected ${expectedPermissions.join(", ")}; found ${
        (manifest.permissions || []).join(", ") || "none"
      }.`
    );
  }

  if (!sameSortedValues(manifest.host_permissions, expectedHostPermissions)) {
    errors.push(
      `host_permissions changed. Expected ${expectedHostPermissions.join(", ")}; found ${
        (manifest.host_permissions || []).join(", ") || "none"
      }.`
    );
  }

  if (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length !== 1) {
    errors.push("Expected exactly one content_scripts entry.");
  } else {
    const [contentScript] = manifest.content_scripts;
    for (const [key, value] of Object.entries(expectedContentScript)) {
      if (JSON.stringify(contentScript[key]) !== JSON.stringify(value)) {
        errors.push(`content_scripts[0].${key} changed from the reviewed release shape.`);
      }
    }
  }
}

for (const file of ["README.md", "PRIVACY_POLICY.md", "CHROME_STORE_SUBMISSION.md"]) {
  if (!(await exists(file))) {
    continue;
  }

  const text = await readFile(path.join(root, file), "utf8");
  for (const permission of [...expectedPermissions, ...expectedHostPermissions]) {
    if (!text.includes(permission)) {
      errors.push(`${file} must document ${permission}.`);
    }
  }
}

if (errors.length) {
  console.error("Release validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Release validation passed.");
