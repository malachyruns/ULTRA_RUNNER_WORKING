/**
 * Auto-search: given a race name + date, search DUV and UltraSignup for matching result pages.
 * Returns a ranked list of candidate URLs the organiser can confirm and import from.
 */
import axios from "axios";
import * as cheerio from "cheerio";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; UltraRank/1.0; +https://ultrarank.run)",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export interface SearchCandidate {
  url: string;
  source: string;
  title: string;
  date?: string | null;
  finishers?: number | null;
  confidence: "high" | "medium" | "low";
}

/** Normalise a race name to a search-friendly string */
function normalise(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words that must overlap for a result to be considered a match */
function keywordScore(raceName: string, candidate: string): number {
  const raceWords = new Set(normalise(raceName).split(" ").filter(w => w.length > 3));
  const candWords = normalise(candidate).split(" ");
  let hits = 0;
  for (const w of candWords) {
    if (raceWords.has(w)) hits++;
  }
  return raceWords.size > 0 ? hits / raceWords.size : 0;
}

function confidenceFromScore(score: number, dateMatch: boolean): SearchCandidate["confidence"] {
  if (score >= 0.7 && dateMatch) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

/** Search DUV Ultramarathon Statistics for a race by name and year */
async function searchDuv(raceName: string, year: number): Promise<SearchCandidate[]> {
  const query = encodeURIComponent(raceName);
  const searchUrl = `https://statistik.d-u-v.org/search.php?search=${query}&year=${year}&dist=all&gender=all&cat=all&nat=all`;

  let html: string;
  try {
    const resp = await axios.get(searchUrl, { headers: HEADERS, timeout: 12000 });
    html = resp.data as string;
  } catch {
    return [];
  }

  const $ = cheerio.load(html);
  const candidates: SearchCandidate[] = [];

  // DUV search results are typically <a> links in a results table
  $("a[href*='getresultevent']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const title = $(el).text().trim();
    if (!href || !title) return;

    const fullUrl = href.startsWith("http") ? href : `https://statistik.d-u-v.org/${href}`;
    const score = keywordScore(raceName, title);
    const dateMatch = href.includes(String(year)) || title.includes(String(year));

    if (score > 0.2 || title.toLowerCase().includes(normalise(raceName).split(" ")[0])) {
      candidates.push({
        url: fullUrl,
        source: "DUV Ultramarathon Statistics",
        title,
        date: dateMatch ? String(year) : null,
        finishers: null,
        confidence: confidenceFromScore(score, dateMatch),
      });
    }
  });

  // Also try the event-list approach for more structured data
  $("table tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return;
    const link = $(row).find("a[href*='getresultevent']");
    if (!link.length) return;

    const title = link.text().trim();
    const href = link.attr("href") ?? "";
    if (!title || !href) return;

    const fullUrl = href.startsWith("http") ? href : `https://statistik.d-u-v.org/${href}`;
    // Avoid duplicate
    if (candidates.some(c => c.url === fullUrl)) return;

    const rowText = $(row).text();
    const score = keywordScore(raceName, title);
    const dateMatch = rowText.includes(String(year));

    if (score > 0.2) {
      candidates.push({
        url: fullUrl,
        source: "DUV Ultramarathon Statistics",
        title,
        date: dateMatch ? String(year) : null,
        finishers: null,
        confidence: confidenceFromScore(score, dateMatch),
      });
    }
  });

  // Sort by confidence
  const order: Record<SearchCandidate["confidence"], number> = { high: 0, medium: 1, low: 2 };
  return candidates.sort((a, b) => order[a.confidence] - order[b.confidence]).slice(0, 10);
}

/** Search UltraSignup for a race by name and year */
async function searchUltraSignup(raceName: string, year: number): Promise<SearchCandidate[]> {
  const query = encodeURIComponent(raceName);
  const searchUrl = `https://ultrasignup.com/results_participant.aspx#n=${query}`;

  // UltraSignup's participant search is JS-rendered. Instead try their results listing
  const altUrl = `https://ultrasignup.com/results_event.aspx?d=${encodeURIComponent(raceName)}`;
  let html: string;
  try {
    const resp = await axios.get(altUrl, { headers: HEADERS, timeout: 12000 });
    html = resp.data as string;
  } catch {
    return [];
  }

  const textLength = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
  if (textLength < 500) return []; // JS-rendered shell

  const $ = cheerio.load(html);
  const candidates: SearchCandidate[] = [];

  $("a[href*='results_event']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const title = $(el).text().trim();
    if (!title || !href) return;

    const fullUrl = href.startsWith("http") ? href : `https://ultrasignup.com${href}`;
    if (candidates.some(c => c.url === fullUrl)) return;

    const score = keywordScore(raceName, title);
    const dateMatch = title.includes(String(year));

    if (score > 0.3) {
      candidates.push({
        url: fullUrl,
        source: "UltraSignup",
        title,
        date: dateMatch ? String(year) : null,
        finishers: null,
        confidence: confidenceFromScore(score, dateMatch),
      });
    }
  });

  return candidates.slice(0, 5);
}

/** Main entry: search all sources and return merged, ranked candidates */
export async function searchForRaceResults(
  raceName: string,
  raceDate: string, // ISO date string, e.g. "2024-06-15"
): Promise<SearchCandidate[]> {
  const year = new Date(raceDate).getFullYear();
  if (isNaN(year)) return [];

  const [duvResults, usResults] = await Promise.allSettled([
    searchDuv(raceName, year),
    searchUltraSignup(raceName, year),
  ]);

  const duv = duvResults.status === "fulfilled" ? duvResults.value : [];
  const us = usResults.status === "fulfilled" ? usResults.value : [];

  const all = [...duv, ...us];
  const order: Record<SearchCandidate["confidence"], number> = { high: 0, medium: 1, low: 2 };
  return all.sort((a, b) => order[a.confidence] - order[b.confidence]).slice(0, 15);
}
