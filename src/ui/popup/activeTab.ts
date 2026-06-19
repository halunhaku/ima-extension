interface ChromeTabsLike {
  get(tabId: number): Promise<chrome.tabs.Tab>;
  query(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]>;
}

interface ChromeLike {
  tabs: ChromeTabsLike;
}

interface LocationLike {
  search: string;
}

export async function getTargetTab(
  locationLike: LocationLike = window.location,
  chromeLike: ChromeLike = chrome
): Promise<chrome.tabs.Tab> {
  const tabId = Number(new URLSearchParams(locationLike.search).get("tabId"));
  if (Number.isInteger(tabId) && tabId > 0) {
    const tab = await chromeLike.tabs.get(tabId);
    if (tab?.id) {
      return tab;
    }
  }

  const [tab] = await chromeLike.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("No active tab is available.");
  }
  return tab;
}
