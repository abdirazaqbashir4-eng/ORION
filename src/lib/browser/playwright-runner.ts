import "server-only";
import { chromium } from "playwright";
import { env, features } from "@/lib/env";

const NOT_AVAILABLE_MESSAGE =
  "Browser automation isn't available in this deployment (Vercel serverless can't host a real browser process). It runs in the ORION desktop app and in traditional Node hosting.";

export interface ScrapeResult {
  url: string;
  title: string;
  text: string;
}

export interface SearchResult {
  query: string;
  results: { title: string; url: string; snippet: string }[];
}

async function withBrowser<T>(fn: (page: import("playwright").Page) => Promise<T>): Promise<T> {
  const browser = await chromium.launch({ headless: env.PLAYWRIGHT_HEADLESS });
  try {
    const page = await browser.newPage();
    return await fn(page);
  } finally {
    await browser.close();
  }
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  if (!features.browserAutomation) throw new Error(NOT_AVAILABLE_MESSAGE);

  return withBrowser(async (page) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    const title = await page.title();
    const text = await page.evaluate(() => document.body.innerText);
    return { url, title, text: text.slice(0, 8000) };
  });
}

/** Scrapes DuckDuckGo's no-JS HTML results page — no search API key required. */
export async function searchWeb(query: string): Promise<SearchResult> {
  if (!features.browserAutomation) throw new Error(NOT_AVAILABLE_MESSAGE);

  return withBrowser(async (page) => {
    await page.goto(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    const results = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".result")).slice(0, 8).map((el) => ({
        title: el.querySelector(".result__title")?.textContent?.trim() ?? "",
        url: el.querySelector(".result__a")?.getAttribute("href") ?? "",
        snippet: el.querySelector(".result__snippet")?.textContent?.trim() ?? "",
      }))
    );

    return { query, results: results.filter((r) => r.title) };
  });
}
