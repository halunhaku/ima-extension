const { execFileSync } = require("node:child_process");
const { existsSync, mkdirSync, rmSync } = require("node:fs");
const { resolve } = require("node:path");
const packageJson = require("../package.json");

const root = resolve(__dirname, "..");
const releasesDir = resolve(root, "releases");
const zipPath = resolve(releasesDir, `web-clipper-for-ima-v${packageJson.version}.zip`);

function run(command, args) {
  execFileSync(command, args, {
    cwd: root,
    stdio: "inherit"
  });
}

const powershellCommand = process.platform === "win32" ? "powershell.exe" : "pwsh";
const cmdCommand = process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : null;

function runNpm(args) {
  if (process.platform === "win32") {
    run(cmdCommand, ["/d", "/s", "/c", "npm", ...args]);
    return;
  }

  run("npm", args);
}

runNpm(["test"]);
runNpm(["run", "build"]);

mkdirSync(releasesDir, { recursive: true });
if (existsSync(zipPath)) {
  rmSync(zipPath);
}

run(powershellCommand, [
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  `Compress-Archive -Path "${resolve(root, "dist", "*")}" -DestinationPath "${zipPath}" -Force`
]);

console.log(`Packaged ${zipPath}`);
