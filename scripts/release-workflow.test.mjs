import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(scriptDir, "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "release.yml");
const readmePath = path.join(repoRoot, "README.md");
const chromeGuidePath = path.join(repoRoot, "CHROME_STORE_SUBMISSION.md");
const edgeGuidePath = path.join(repoRoot, "EDGE_STORE_SUBMISSION.md");

async function readWorkflow() {
  return readFile(workflowPath, "utf8");
}

function positionOf(source, token) {
  const position = source.indexOf(token);
  assert.notEqual(position, -1, `Expected workflow to contain: ${token}`);
  return position;
}

function sectionOf(source, heading) {
  const start = positionOf(source, heading);
  const next = source.indexOf("\n## ", start + heading.length);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

function stepNames(workflow) {
  return [...workflow.matchAll(/^      - name: (.+)$/gm)].map((match) => match[1]);
}

test("release workflow has only the tag triggers and one retry input", async () => {
  const workflow = await readWorkflow();

  assert.match(workflow, /^name: Release$/m);
  assert.match(
    workflow,
    /^on:\n  push:\n    tags:\n      - "v\*"\n  workflow_dispatch:\n    inputs:\n      tag:\n        description: .+\n        required: true\n        type: string$/m
  );
  assert.doesNotMatch(workflow, /pull_request|workflow_run|schedule:/);
  assert.equal(
    (workflow.match(/^        type: /gm) ?? []).length,
    1,
    "workflow_dispatch must expose the tag input only"
  );
  assert.doesNotMatch(workflow, /publish_github_release_only/);
});

test("release workflow keeps the repository-wide controls for a single release at a time", async () => {
  const workflow = await readWorkflow();

  assert.match(workflow, /^permissions:\n  contents: write$/m);
  assert.match(workflow, /^concurrency:\n  group: release\n  queue: max\n  cancel-in-progress: false$/m);
  assert.match(workflow, /^jobs:\n  release:\n    runs-on: ubuntu-latest\n    timeout-minutes: 30$/m);
});

test("release workflow resolves an exact tag and checks that tag out before building", async () => {
  const workflow = await readWorkflow();

  assert.match(
    workflow,
    /REQUESTED_TAG: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.tag \|\| github\.ref_name \}\}/
  );
  assert.match(workflow, /\^v\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\$/);
  assert.match(workflow, /echo "tag=\$REQUESTED_TAG" >> "\$GITHUB_OUTPUT"/);
  assert.match(workflow, /echo "version=\$\{REQUESTED_TAG#v\}" >> "\$GITHUB_OUTPUT"/);
  assert.match(
    workflow,
    /uses: actions\/checkout@v4\n        with:\n          fetch-depth: 0\n          ref: refs\/tags\/\$\{\{ steps\.release\.outputs\.tag \}\}/
  );
  assert.match(workflow, /uses: actions\/setup-node@v4\n        with:\n          node-version: 20\n          cache: npm/);
  assert.match(workflow, /- name: Install dependencies\n        run: npm ci/);
  assert.doesNotMatch(workflow, /recovery/);
});

test("release workflow runs verify, test, validate, package, then the Release step in that order", async () => {
  const workflow = await readWorkflow();

  assert.deepEqual(stepNames(workflow), [
    "Resolve release tag",
    "Check out release tag",
    "Set up Node.js",
    "Install dependencies",
    "Verify release version",
    "Run tests",
    "Validate release",
    "Package extension",
    "Create or update GitHub Release",
    "Summarize release failure"
  ]);

  const orderedCommands = [
    'node scripts/release-version.mjs "$TAG"',
    "npm test",
    "npm run validate",
    "npm run package",
    'gh release create "$TAG"',
    'gh release upload "$TAG" "$ASSET" --clobber'
  ];
  const positions = orderedCommands.map((token) => positionOf(workflow, token));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test("release workflow publishes the Release publicly and only refreshes an existing one", async () => {
  const workflow = await readWorkflow();
  const releaseStep = sectionOf(workflow, "- name: Create or update GitHub Release");

  assert.equal((workflow.match(/gh release create/g) ?? []).length, 1);
  assert.match(
    releaseStep,
    /gh release create "\$TAG" --verify-tag --title "Web Clipper for ima \$TAG" --notes "Automated release for \$TAG\."/
  );
  assert.doesNotMatch(releaseStep, /--draft/);
  assert.match(releaseStep, /ASSET="dist\/web-clipper-for-ima-\$VERSION\.zip"/);
  assert.match(
    releaseStep,
    /if gh release view "\$TAG" >\/dev\/null 2>&1; then[\s\S]*gh release upload "\$TAG" "\$ASSET" --clobber/
  );
  assert.doesNotMatch(releaseStep, /exit 1/, "an existing Release for the tag must be refreshed, not rejected");
});

test("release workflow contains no store credentials, store commands, or draft handling", async () => {
  const workflow = await readWorkflow();

  for (const pattern of [/secrets\./, /CWS_/, /EDGE_/, /cws:/, /edge:/i]) {
    assert.doesNotMatch(workflow, pattern);
  }
  assert.doesNotMatch(workflow, /Chrome Web Store|Edge Add-ons/i);
  assert.doesNotMatch(workflow, /gh release edit|--draft/);
});

test("release failure summary explains the build gate without mentioning stores", async () => {
  const workflow = await readWorkflow();
  const failureStep = sectionOf(workflow, "- name: Summarize release failure");

  assert.match(failureStep, /if: failure\(\)/);
  assert.match(failureStep, /\$GITHUB_STEP_SUMMARY/);
  assert.match(failureStep, /only created after tests, validation, and packaging all succeed/i);
  assert.doesNotMatch(failureStep, /store|Chrome|Edge|draft/i);
});

test("npm scripts keep only the build and test contracts", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

  assert.equal(packageJson.scripts["test:scripts"], "node --test scripts/package-release.test.mjs scripts/release-version.test.mjs scripts/release-workflow.test.mjs");
  for (const name of Object.keys(packageJson.scripts)) {
    assert.doesNotMatch(name, /^(cws|edge):/, `store script \`${name}\` must stay deleted`);
  }
  assert.doesNotMatch(packageJson.scripts["test:scripts"], /cws|edge/i);
});

test("release docs send the reader to the Release asset for a manual store upload", async () => {
  const [readme, chromeGuide, edgeGuide] = await Promise.all([
    readFile(readmePath, "utf8"),
    readFile(chromeGuidePath, "utf8"),
    readFile(edgeGuidePath, "utf8")
  ]);

  for (const [name, doc] of [
    ["README.md", readme],
    ["CHROME_STORE_SUBMISSION.md", chromeGuide],
    ["EDGE_STORE_SUBMISSION.md", edgeGuide]
  ]) {
    assert.doesNotMatch(
      doc,
      /CWS_(CLIENT_ID|CLIENT_SECRET|REFRESH_TOKEN|ITEM_ID)|EDGE_(PRODUCT_ID|CLIENT_ID|API_KEY)|publish_github_release_only|npm run (cws|edge):/,
      `${name} must not describe deleted store automation`
    );
  }

  for (const [name, guide] of [
    ["CHROME_STORE_SUBMISSION.md", chromeGuide],
    ["EDGE_STORE_SUBMISSION.md", edgeGuide]
  ]) {
    assert.match(guide, /GitHub Release/i, `${name} must point at the GitHub Release`);
    assert.match(guide, /manual/i, `${name} must describe the manual upload`);
    assert.match(guide, /web-clipper-for-ima-X\.Y\.Z\.zip/, `${name} must name the Release asset`);
  }

  const releaseRules = sectionOf(readme, "## Release rules");
  assert.match(releaseRules, /public GitHub Release/i);
  assert.match(releaseRules, /manual/i);
  assert.doesNotMatch(releaseRules, /draft/i);
});
