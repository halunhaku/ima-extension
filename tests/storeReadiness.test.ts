import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

function readManifest() {
  return JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8")) as {
    content_scripts?: unknown;
    host_permissions?: string[];
    icons?: Record<string, string>;
  };
}

describe("Chrome Web Store readiness", () => {
  it("does not request persistent access to every page", () => {
    const manifest = readManifest();

    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.host_permissions ?? []).not.toContain("<all_urls>");
  });

  it("declares required extension icons that are included in the package source", () => {
    const manifest = readManifest();

    expect(manifest.icons).toEqual({
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    });

    for (const iconPath of Object.values(manifest.icons ?? {})) {
      expect(existsSync(resolve(root, "public", iconPath))).toBe(true);
    }
  });
});
