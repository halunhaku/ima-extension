/**
 * capture-screenshots.mjs
 *
 * Automatically captures Chrome Web Store listing screenshots
 * by loading the built popup in Puppeteer with mocked chrome APIs.
 *
 * Usage:  node scripts/capture-screenshots.mjs
 * Prereq: npm run build  (or the script runs it for you)
 */

import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import puppeteer from "puppeteer";

// ── Paths ────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = join(ROOT, "dist");
const OUT = join(ROOT, "docs/store-assets/screenshots");

// ── Rich article HTML (used by @mozilla/readability + turndown) ──────────────
const ARTICLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta property="og:site_name" content="Data Engineering Weekly"/>
<title>Web Scraping: Techniques and Best Practices for 2025</title></head>
<body>
<article>
<h1>Web Scraping: Techniques and Best Practices for 2025</h1>
<p>Web scraping has become an essential tool for data engineers, researchers, and businesses who need to collect structured information from the web at scale. As websites grow more sophisticated, so do the techniques required to extract data reliably and ethically.</p>

<h2>Understanding the Basics</h2>
<p>At its core, web scraping involves fetching a web page and parsing its HTML to extract meaningful data. The most common approach is to send an HTTP request to a server, receive the HTML response, and then use a parser like jsdom to navigate the DOM tree and pull out the relevant elements.</p>
<p>However, many modern websites render their content with JavaScript, which means the initial HTML response may contain little more than an empty shell. In those cases, a headless browser — such as Puppeteer or Playwright — is needed to execute the JavaScript first, then scrape the fully rendered page.</p>

<h2>Key Techniques</h2>
<h3>HTML Parsing with Readability</h3>
<p>Tools like Mozilla's Readability library strip away navigation, ads, and sidebars, leaving only the core article content. This is particularly useful when you want clean, readable text without the clutter of the surrounding page layout. The extracted content can then be converted to Markdown using a library like Turndown.</p>

<h3>API Integration</h3>
<p>Some websites provide public or internal APIs that return structured JSON data. When available, an API-based approach is far more reliable than HTML scraping because the data format is well-defined and less likely to break when the website's layout changes. Tools like mitmproxy can help discover undocumented APIs by intercepting network traffic.</p>

<h3>Handling JavaScript-Rendered Content</h3>
<p>Single-page applications built with React, Vue, or Angular often load content asynchronously. A headless browser evaluates the JavaScript and waits for network requests to complete before the page content is fully available.</p>

<h2>Best Practices</h2>
<ul>
<li><strong>Respect robots.txt:</strong> Always check the website's robots.txt file before scraping.</li>
<li><strong>Rate limiting:</strong> Space out your requests to avoid overwhelming the server.</li>
<li><strong>User-Agent rotation:</strong> Identify your scraper with a descriptive User-Agent string.</li>
<li><strong>Error handling:</strong> Network requests fail, pages change their structure, and servers return unexpected status codes.</li>
<li><strong>Data validation:</strong> Always validate and sanitise the scraped data before storing it.</li>
</ul>

<h3>Legal and Ethical Considerations</h3>
<p>Web scraping exists in a complex legal landscape. In many jurisdictions, scraping publicly accessible data for research or personal use is permissible, but re-publishing substantial portions of scraped content may violate copyright law.</p>

<h2>Tooling Ecosystem</h2>
<p>The web scraping ecosystem has matured significantly over the past decade. Open-source libraries like Scrapy (Python), Puppeteer (JavaScript), and HTTrack provide robust foundations. Managed services such as ScrapingBee and Apify offer proxy rotation, CAPTCHA solving, and headless browser orchestration out of the box.</p>
<p>For smaller projects, a simple combination of <code>node-fetch</code>, <code>jsdom</code>, and <code>@mozilla/readability</code> is often sufficient. The ima Clipper extension itself uses exactly this stack.</p>

<h2>Conclusion</h2>
<p>Web scraping remains a valuable skill in the data engineering toolkit. While the landscape continues to evolve — with more JavaScript rendering, stricter anti-bot measures, and shifting legal frameworks — the core principles of respectful, robust, and well-tested scraping practices have not changed.</p>
</article>
</body></html>`;

// ── Static file server ───────────────────────────────────────────────────────

function startFileServer(rootDir, port) {
  const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".woff2": "font/woff2",
  };

  const server = createServer((req, res) => {
    const urlPath = req.url.split("?")[0].replace(/\/$/, "") || "/index.html";
    const filePath = join(rootDir, urlPath);
    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    try {
      const content = readFileSync(filePath);
      const ext = extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(content);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

// ── Helper ───────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Promo image (440×280) ────────────────────────────────────────────────────

async function capturePromo(browser, outDir) {
  const page = await browser.newPage();
  await page.setViewport({ width: 440, height: 280 });

  // Render the promo entirely via injected HTML
  await page.setContent(
    `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:440px;height:280px;overflow:hidden;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(145deg,#f6f4eb,#eeeadf);font-family:system-ui,-apple-system,sans-serif}
.card{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;padding:24px}
.brand{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:0.1em;
  text-transform:uppercase;color:#527a66}
.dot{width:8px;height:8px;border-radius:50%;
  background:linear-gradient(135deg,#0f9f6e,#34d399);box-shadow:0 0 0 3px rgba(15,159,110,0.12)}
h1{font-size:22px;font-weight:700;color:#0f172a;line-height:1.2}
p{font-size:12.5px;color:#4b5563;line-height:1.5;max-width:340px}
.features{display:flex;gap:16px;margin-top:4px}
.feature{display:flex;flex-direction:column;align-items:center;gap:4px}
.feature span{font-size:18px;font-weight:700;color:#0f9f6e}
.feature label{font-size:10px;color:#6b7280;font-weight:500}
</style>
</head>
<body>
<div class="card">
  <div class="brand"><span class="dot"></span>Web Clipper for ima</div>
  <h1>Clip pages. Save knowledge.</h1>
  <p>Extract clean Markdown from any webpage and save it directly to your ima knowledge base.</p>
  <div class="features">
    <div class="feature"><span>1</span><label>Click to capture</label></div>
    <div class="feature"><span>3</span><label>View modes</label></div>
    <div class="feature"><span>1</span><label>Click to save</label></div>
  </div>
</div>
</body>
</html>`,
    { waitUntil: "networkidle0" },
  );

  await sleep(300);
  const filePath = join(outDir, "promo-small-440x280.png");
  await page.screenshot({ path: filePath });
  return filePath;
}

// ── Screenshot capture ───────────────────────────────────────────────────────

async function capturePopup(page, serverPort, scenario, label) {
  const distUrl = `http://127.0.0.1:${serverPort}/`;

  // Inject chrome mocks + optional fetch mock BEFORE page JS runs
  // IMPORTANT: the callback builds mocks inline because evaluateOnNewDocument
  // serializes its data argument via structured clone (functions are lost).
  await page.evaluateOnNewDocument(
    (scenario, articleHTML) => {
      const capture = (() => {
        const base = {
          title: "Web Scraping: Techniques and Best Practices for 2025",
          url: "https://dataengineeringweekly.com/posts/web-scraping-guide-2025",
          html: articleHTML,
          capturedAt: new Date().toISOString(),
          sourceMode: "auto",
          selectedHtml: "",
          selectedText: "",
          selectedSelector: "",
        };
        if (scenario === "manualArea") {
          const m = articleHTML.match(/<article>([\s\S]*)<\/article>/);
          return {
            ...base,
            sourceMode: "manualArea",
            selectedHtml: m ? m[1] : "<p>area</p>",
            selectedSelector: "article",
          };
        }
        return base;
      })();

      const hasIma = scenario === "saveToIma";
      const imaSettings = hasIma
        ? {
            credentials: { clientId: "cli_abc123def456", apiKey: "sk-••••••••" },
            selectedKnowledgeBaseId: "kb_research_01",
          }
        : {};

      window.chrome = {
        tabs: {
          query: () => Promise.resolve([{ id: 12345, url: capture.url }]),
          sendMessage: (_tid, msg) =>
            msg.type === "IMA_CLIPPER_CAPTURE_PAGE"
              ? Promise.resolve(capture)
              : Promise.resolve({}),
          get: (id) => Promise.resolve({ id, url: capture.url }),
          create: () => Promise.resolve({ id: 99999 }),
        },
        scripting: {
          executeScript: () => Promise.resolve([{ result: null }]),
        },
        storage: {
          session: {
            get: () => Promise.resolve({}),
            set: () => Promise.resolve(),
            remove: () => Promise.resolve(),
          },
          local: {
            get: () =>
              Promise.resolve({ imaClipperSettings: imaSettings }),
            set: () => Promise.resolve(),
            remove: () => Promise.resolve(),
          },
        },
        runtime: {
          id: "mock-ext-id",
          getURL: (p) => p,
          sendMessage: () => Promise.resolve({}),
          onMessage: { addListener: () => {} },
        },
        action: {},
        contextMenus: {
          create: () => {},
          onClicked: { addListener: () => {} },
        },
        windows: { create: () => Promise.resolve({ id: 98765 }) },
      };

      // Mock fetch for ima API (saveToIma scenario)
      if (hasIma) {
        const origFetch = window.fetch.bind(window);
        window.fetch = async (url, opts) => {
          const u = typeof url === "string" ? url : url.toString();
          if (u.includes("ima.qq.com")) {
            if (u.includes("get_addable_knowledge_base_list")) {
              return new Response(
                JSON.stringify({
                  code: 0,
                  data: {
                    addable_knowledge_base_list: [
                      { id: "kb_general_01", name: "General Notes" },
                      { id: "kb_research_01", name: "Research" },
                      { id: "kb_dev_01", name: "Dev Reference" },
                    ],
                  },
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
              );
            }
            if (u.includes("import_doc")) {
              return new Response(
                JSON.stringify({ code: 0, data: { note_id: "mock-note-001" } }),
                { status: 200, headers: { "Content-Type": "application/json" } },
              );
            }
            if (u.includes("add_knowledge")) {
              return new Response(
                JSON.stringify({ code: 0, data: { media_id: "mock-media-001" } }),
                { status: 200, headers: { "Content-Type": "application/json" } },
              );
            }
          }
          return origFetch(url, opts);
        };
      }
    },
    scenario,  // pass as primitive strings (survive structured clone)
    ARTICLE_HTML,
  );

  // Navigate to the built popup page
  await page.goto(distUrl, { waitUntil: "networkidle0" });

  // Wait for React app to mount (brand mark appears immediately)
  await page.waitForSelector(".brand-mark", { timeout: 10000 });

  // Let async operations (capture, extraction, ima settings) settle
  await sleep(2000);

  // Wait for specific content per scenario
  if (scenario === "reader") {
    try {
      await page.waitForSelector(".reader-content", { timeout: 6000 });
    } catch {
      console.warn("    ⚠ reader-content not found");
    }
  }

  if (scenario === "saveToIma") {
    try {
      // Wait for ima panel to show knowledge base selector (means fetch mock worked)
      await page.waitForSelector(".ima-select-compact option", { timeout: 6000 });
    } catch {
      console.warn("    ⚠ ima knowledge bases not loaded");
    }
  }

  // Style for a clean 1280×800 screenshot with info panel on the right
  await page.evaluate((scenario) => {
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.width = "1280px";
    document.body.style.height = "800px";
    document.body.style.overflow = "hidden";
    document.body.style.background = "#f4f2ea";
    document.body.style.display = "flex";
    document.body.style.alignItems = "stretch";

    const root = document.getElementById("root");
    if (root) {
      root.style.minHeight = "auto";
      root.style.height = "auto";
      root.style.background = "transparent";
    }

    // Wrap everything in a centred layout
    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "display:flex;align-items:center;justify-content:center;flex:1;gap:32px;padding:40px;height:100%;";

    const main = document.querySelector("main");
    if (main) {
      main.style.boxShadow = "0 4px 32px rgba(0,0,0,0.09)";
      main.style.borderRadius = "14px";
      main.style.flexShrink = "0";
    }

    // ── Info panel (right side) ──
    const infoMap = {
      reader: {
        title: "Reader View",
        tagline: "Clean, readable extraction from any page",
        bullets: [
          "Full-page article extraction",
          "Auto / Selection / Manual Area modes",
          "Rich reader view for quality check",
        ],
      },
      manualArea: {
        title: "Manual Area Capture",
        tagline: "Select exactly the content you need",
        bullets: [
          "Click any element to clip it",
          "Preserves original formatting",
          "Perfect for tables, code blocks, sidebars",
        ],
      },
      saveToIma: {
        title: "Save to ima",
        tagline: "Directly into your knowledge base",
        bullets: [
          "Connect with your ima account",
          "Choose a knowledge base target",
          "Save as note or add to existing wiki",
        ],
      },
    };

    const info = infoMap[scenario] || infoMap.reader;

    const panel = document.createElement("div");
    panel.style.cssText =
      "display:flex;flex-direction:column;gap:20px;width:380px;flex-shrink:0;";

    // Brand
    const brand = document.createElement("div");
    brand.style.cssText =
      "display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#4a7c65;";
    const dot = document.createElement("span");
    dot.style.cssText =
      "display:inline-block;width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,#0f9f6e,#34d399);box-shadow:0 0 0 4px rgba(15,159,110,0.12);";
    brand.appendChild(dot);
    brand.appendChild(document.createTextNode("ima Clipper"));

    // Feature title
    const title = document.createElement("h2");
    title.textContent = info.title;
    title.style.cssText =
      "margin:0;font-size:28px;font-weight:700;line-height:1.2;color:#0f172a;";

    // Tagline
    const tagline = document.createElement("p");
    tagline.textContent = info.tagline;
    tagline.style.cssText =
      "margin:0;font-size:15px;line-height:1.5;color:#4b5563;";

    // Divider
    const divider = document.createElement("div");
    divider.style.cssText =
      "height:2px;width:60px;background:linear-gradient(90deg,#0f9f6e,transparent);border-radius:1px;";

    // Bullet list
    const list = document.createElement("ul");
    list.style.cssText =
      "margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px;";
    for (const text of info.bullets) {
      const li = document.createElement("li");
      li.style.cssText =
        "display:flex;align-items:center;gap:10px;font-size:14px;line-height:1.4;color:#374151;";
      const check = document.createElement("span");
      check.textContent = "✓";
      check.style.cssText =
        "display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:rgba(15,159,110,0.12);color:#0f9f6e;font-size:12px;font-weight:700;flex-shrink:0;";
      li.appendChild(check);
      li.appendChild(document.createTextNode(text));
      list.appendChild(li);
    }

    panel.append(brand, title, tagline, divider, list);

    // ── Assemble ──
    // Move #root (with the popup) into the wrapper, then insert panel
    root?.parentNode?.insertBefore(wrapper, root);
    wrapper.appendChild(root || document.body);
    wrapper.appendChild(panel);
  }, scenario);

  await sleep(300);

  const filePath = join(OUT, `${label}-1280x800.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("→ Building extension...");
  execSync("npm run build", { cwd: ROOT, stdio: "inherit" });

  mkdirSync(OUT, { recursive: true });
  const PROMO_DIR = resolve(OUT, ".."); // docs/store-assets

  const PORT = 9876;
  console.log(`→ Starting static server on :${PORT}...`);
  const server = await startFileServer(DIST, PORT);

  console.log("→ Launching Puppeteer...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const scenarios = [
      { scenario: "reader", label: "01-reader-capture" },
      { scenario: "manualArea", label: "02-manual-area" },
      { scenario: "saveToIma", label: "03-save-to-ima" },
    ];

    for (const { scenario, label } of scenarios) {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: 1280, height: 800 });

      console.log(`  📸 ${label}...`);

      // Dump page state for debugging
      page.on("pageerror", (err) => {
        console.error(`    🐛 page error: ${err.message}`);
      });

      const fp = await capturePopup(page, PORT, scenario, label);
      console.log(`     → ${fp}`);
      await ctx.close();
    }

    // Promo image
    console.log(`  📸 promo-small...`);
    const promoPath = await capturePromo(browser, PROMO_DIR);
    console.log(`     → ${promoPath}`);

    console.log("\n✅ All screenshots captured.");
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
