import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workflowPath = path.join(scriptDir, "..", ".github", "workflows", "release.yml");
const chromeGuidePath = path.join(scriptDir, "..", "CHROME_STORE_SUBMISSION.md");
const edgeGuidePath = path.join(scriptDir, "..", "EDGE_STORE_SUBMISSION.md");

async function readWorkflow() {
  return readFile(workflowPath, "utf8");
}

function positionOf(source, token) {
  const position = source.indexOf(token);
  assert.notEqual(position, -1, `Expected workflow to contain: ${token}`);
  return position;
}

test("release workflow has only the intended triggers and repository-wide controls", async () => {
  const workflow = await readWorkflow();

  assert.match(workflow, /^name: Release$/m);
  assert.match(workflow, /^on:\n  push:\n    tags:\n      - "v\*"\n  workflow_dispatch:\n    inputs:/m);
  assert.match(workflow, /^      tag:\n        description: .*\n        required: true\n        type: string$/m);
  assert.match(workflow, /^      publish_github_release_only:\n        description: .*Chrome.*Edge.*\n        required: false\n        default: false\n        type: boolean$/m);
  assert.doesNotMatch(workflow, /pull_request/);
  assert.match(workflow, /^permissions:\n  contents: write$/m);
  assert.match(workflow, /^concurrency:\n  group: browser-store-release\n  queue: max\n  cancel-in-progress: false$/m);
  assert.match(workflow, /^jobs:\n  release:\n    runs-on: ubuntu-latest\n    timeout-minutes: 30$/m);
});

test("release workflow resolves and validates an exact tag before checking it out", async () => {
  const workflow = await readWorkflow();

  assert.match(workflow, /REQUESTED_TAG: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.tag \|\| github\.ref_name \}\}/);
  assert.match(workflow, /\^v\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\$/);
  assert.match(workflow, /echo "tag=\$REQUESTED_TAG" >> "\$GITHUB_OUTPUT"/);
  assert.match(workflow, /echo "version=\$\{REQUESTED_TAG#v\}" >> "\$GITHUB_OUTPUT"/);
  assert.match(workflow, /uses: actions\/checkout@v4\n        with:\n          fetch-depth: 0\n          ref: refs\/tags\/\$\{\{ steps\.release\.outputs\.tag \}\}/);
  assert.match(workflow, /uses: actions\/setup-node@v4\n        with:\n          node-version: 20\n          cache: npm/);
  assert.match(workflow, /- name: Install dependencies\n        if: steps\.release\.outputs\.recovery != 'true'\n        run: npm ci/);
});

test("release workflow verifies, packages, publishes both stores, then publishes the release", async () => {
  const workflow = await readWorkflow();
  const orderedTokens = [
    'node scripts/release-version.mjs "$TAG"',
    "npm test",
    "npm run validate",
    "npm run package",
    'gh release create "$TAG" --verify-tag --draft --title "Web Clipper for ima $TAG" --notes "Automated release for $TAG."',
    'gh release upload "$TAG" "dist/web-clipper-for-ima-$VERSION.zip" --clobber',
    'npm run cws:publish -- "dist/web-clipper-for-ima-${{ steps.release.outputs.version }}.zip"',
    'npm run edge:publish -- "dist/web-clipper-for-ima-${{ steps.release.outputs.version }}.zip"',
    'gh release edit "$TAG" --draft=false'
  ];
  const positions = orderedTokens.map((token) => positionOf(workflow, token));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test("store secrets are present and confined to their respective steps", async () => {
  const workflow = await readWorkflow();
  const chromeNames = ["CWS_CLIENT_ID", "CWS_CLIENT_SECRET", "CWS_REFRESH_TOKEN", "CWS_ITEM_ID"];
  const edgeNames = ["EDGE_PRODUCT_ID", "EDGE_CLIENT_ID", "EDGE_API_KEY"];
  const chromeStart = positionOf(workflow, "- name: Publish to Chrome Web Store");
  const edgeStart = positionOf(workflow, "- name: Publish to Microsoft Edge Add-ons");
  const githubStart = positionOf(workflow, "- name: Publish GitHub Release");
  const chromeStep = workflow.slice(chromeStart, edgeStart);
  const edgeStep = workflow.slice(edgeStart, githubStart);

  for (const name of chromeNames) {
    const reference = `${name}: \${{ secrets.${name} }}`;
    assert.equal((workflow.match(new RegExp(`\\$\\{\\{ secrets\\.${name} \\}\\}`, "g")) ?? []).length, 1);
    assert.match(chromeStep, new RegExp(reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const name of edgeNames) {
    const reference = `${name}: \${{ secrets.${name} }}`;
    assert.equal((workflow.match(new RegExp(`\\$\\{\\{ secrets\\.${name} \\}\\}`, "g")) ?? []).length, 1);
    assert.match(edgeStep, new RegExp(reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(workflow.slice(0, chromeStart) + workflow.slice(githubStart), /secrets\./);
});

test("release workflow keeps failed releases as drafts and documents a safe retry path", async () => {
  const workflow = await readWorkflow();
  const failureStart = positionOf(workflow, "- name: Summarize release failure");
  const failureStep = workflow.slice(failureStart);

  assert.match(failureStep, /if: failure\(\)/);
  assert.match(failureStep, /\$GITHUB_STEP_SUMMARY/);
  assert.match(failureStep, /draft remains/i);
  assert.match(failureStep, /both store dashboards/i);
  assert.match(failureStep, /recovery mode skips both store submissions/i);
});

test("release workflow can recover GitHub publication without resubmitting either store item", async () => {
  const workflow = await readWorkflow();
  assert.match(workflow, /RECOVERY_REQUESTED: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.publish_github_release_only \|\| false \}\}/);
  assert.match(workflow, /echo "recovery=\$RECOVERY_REQUESTED" >> "\$GITHUB_OUTPUT"/);

  for (const step of [
    "Check out release tag",
    "Set up Node.js",
    "Install dependencies",
    "Verify release version",
    "Run tests",
    "Validate release",
    "Package extension",
    "Prepare draft GitHub Release",
    "Publish to Chrome Web Store",
    "Publish to Microsoft Edge Add-ons"
  ]) {
    assert.match(
      workflow,
      new RegExp(`- name: ${step}\\n        if: steps\\.release\\.outputs\\.recovery != 'true'`)
    );
  }

  assert.match(workflow, /Chrome Web Store and Edge Add-ons acceptance were confirmed by the operator/i);
});

test("store guides distinguish a store retry from GitHub-release-only recovery", async () => {
  const chromeGuide = await readFile(chromeGuidePath, "utf8");
  const edgeGuide = await readFile(edgeGuidePath, "utf8");
  for (const guide of [chromeGuide, edgeGuide]) {
    assert.match(guide, /publish_github_release_only/);
    assert.match(guide, /both.*store/i);
  }
  assert.match(chromeGuide, /existing draft/i);
  assert.match(edgeGuide, /skips both store APIs/i);
});

test("npm script contracts include Edge publication and tests", async () => {
  const packageJson = JSON.parse(await readFile(path.join(scriptDir, "..", "package.json"), "utf8"));
  assert.equal(packageJson.scripts["edge:publish"], "node scripts/edge-publish.mjs");
  for (const testPath of ["scripts/edge-api.test.mjs", "scripts/edge-publish.test.mjs", "scripts/release-workflow.test.mjs"]) {
    assert.match(packageJson.scripts["test:scripts"], new RegExp(testPath.replaceAll(".", "\\.")));
  }
});
