export type { ScrapePreview, ScrapedResult } from "./types";
import { isUltraSignupUrl, scrapeUltraSignup } from "./ultrasignup";
import { isDuvUrl, scrapeDuv } from "./duv";
import { scrapeGeneric } from "./generic";
import type { ScrapePreview } from "./types";

export async function scrapeUrl(url: string): Promise<ScrapePreview> {
  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL. Please provide a full URL including https://");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }

  if (isUltraSignupUrl(url)) return scrapeUltraSignup(url);
  if (isDuvUrl(url)) return scrapeDuv(url);
  return scrapeGeneric(url);
}
