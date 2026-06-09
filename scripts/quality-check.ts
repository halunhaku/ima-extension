import { JSDOM } from "jsdom";
import { extractPage } from "../src/core/extraction/extractPage";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://local.invalid/"
});

globalThis.DOMParser = dom.window.DOMParser;

interface QualityTarget {
  type: string;
  url: string;
  expectsCode?: boolean;
}

const targets: QualityTarget[] = [
  {
    type: "普通博客文章",
    url: "https://web.dev/blog/interop-2025?hl=en"
  },
  {
    type: "技术文档页面",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch",
    expectsCode: true
  },
  {
    type: "GitHub README 页面",
    url: "https://github.com/mozilla/readability",
    expectsCode: true
  },
  {
    type: "新闻文章",
    url: "https://www.bbc.com/news/articles/cly2exvx944o"
  },
  {
    type: "复杂页面（知乎）",
    url: "https://www.zhihu.com/question/49564024"
  }
];

function includesNoise(markdown: string): boolean {
  return /sign in|subscribe|cookie|advertisement|评论|登录|注册|相关推荐/i.test(markdown);
}

async function checkTarget(target: QualityTarget) {
  const response = await fetch(target.url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36"
    }
  });
  const html = await response.text();
  const result = extractPage({
    title: target.type,
    url: response.url || target.url,
    html,
    capturedAt: "2026-06-09T00:00:00.000Z"
  });
  const content = result.contentMarkdown;

  return {
    type: target.type,
    requestedUrl: target.url,
    finalUrl: response.url || target.url,
    httpStatus: response.status,
    title: result.title,
    titleOk: result.title.trim().length > 0 && result.title !== target.type,
    urlOk: result.url === (response.url || target.url),
    bodyChars: content.length,
    bodyLikelyComplete: content.length > 800,
    warning: result.extractionWarning ?? "",
    mixedNoise: includesNoise(content),
    headingCount: (content.match(/^#{1,3}\s+/gm) ?? []).length,
    markdownHierarchyOk: /^---\n/.test(result.markdown) && result.markdown.includes("\n# "),
    imageLinks: (content.match(/!\[[^\]]*]\([^)]+\)/g) ?? []).length,
    codeBlocks: (content.match(/```/g) ?? []).length / 2,
    codeExpectationMet: target.expectsCode ? content.includes("```") || /`[^`]+`/.test(content) : true
  };
}

const results = [];
for (const target of targets) {
  try {
    results.push(await checkTarget(target));
  } catch (error) {
    results.push({
      type: target.type,
      requestedUrl: target.url,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

console.log(JSON.stringify(results, null, 2));
