import { describe, expect, it, vi } from "vitest";
import { getTargetTab } from "./activeTab";

function tabWithId(id: number): chrome.tabs.Tab {
  return { id } as chrome.tabs.Tab;
}

describe("getTargetTab", () => {
  it("uses a tabId from the popup URL when one is present", async () => {
    const query = vi.fn();

    const tab = await getTargetTab(
      { search: "?tabId=123" },
      {
        tabs: {
          get: vi.fn(async (tabId: number) => tabWithId(tabId)),
          query
        }
      }
    );

    expect(tab.id).toBe(123);
    expect(query).not.toHaveBeenCalled();
  });

  it("falls back to the active tab in the current window", async () => {
    const tab = await getTargetTab(
      { search: "" },
      {
        tabs: {
          get: vi.fn(),
          query: vi.fn(async () => [tabWithId(456)])
        }
      }
    );

    expect(tab.id).toBe(456);
  });
});
