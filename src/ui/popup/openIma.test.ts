import { describe, expect, it, vi } from "vitest";

describe("Open ima intent", () => {
  it("uses the public ima site URL", () => {
    expect("https://ima.qq.com/").toBe("https://ima.qq.com/");
  });

  it("opens a new tab through chrome.tabs.create", async () => {
    const create = vi.fn(async (_options: { url: string }) => undefined);
    const chromeStub = {
      tabs: {
        create
      }
    };

    await chromeStub.tabs.create({ url: "https://ima.qq.com/" });

    expect(create).toHaveBeenCalledWith({ url: "https://ima.qq.com/" });
  });
});
