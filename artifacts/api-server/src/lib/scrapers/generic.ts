import axios from "axios";
import * as cheerio from "cheerio";
import type { ScrapePreview, ScrapedResult } from "./types";
import { parseTimeToSeconds, parseBirthYear, birthYearFromAge, normalizeAgeCategory } from "./types";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; UltraRank/1.0; +https://ultrarank.run)",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const RANK_KEYS    = ["place", "rank", "position", "pos", "pl", "#", "finish"];
const NAME_KEYS    = ["name", "athlete", "runner", "first", "last", "participant"];
const TIME_KEYS    = ["time", "finish", "gun", "chip", "clock", "result", "perf"];
const GENDER_KEYS  = ["gender", "sex", "m/f", "g"];
const COUNTRY_KEYS = ["country", "nat", "nation", "state", "ctry", "nationality"];
const AGE_KEYS     = ["age", "yob", "born", "birth", "year of birth", "dob"];
const CAT_KEYS     = ["cat", "category", "division", "div", "ag", "age group", "class"];

function colMatch(header: string, keys: string[]): boolean {
  const h = header.toLowerCase().trim();
  return keys.some(k => h === k || h.includes(k));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bestTable($: cheerio.CheerioAPI): cheerio.Cheerio<any> | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let best: cheerio.Cheerio<any> | null = null;
  let bestScore = 0;

  $("table").each((_, el) => {
    const headers: string[] = [];
    $(el).find("tr:first-child th, thead tr th, tr:first-child td").each((_, th) => {
      headers.push($(th).text().trim());
    });

    let score = 0;
    if (headers.some(h => colMatch(h, RANK_KEYS))) score += 3;
    if (headers.some(h => colMatch(h, NAME_KEYS))) score += 3;
    if (headers.some(h => colMatch(h, TIME_KEYS))) score += 2;
    if (headers.some(h => colMatch(h, GENDER_KEYS))) score += 1;
    if (headers.some(h => colMatch(h, AGE_KEYS))) score += 1;

    const rowCount = $(el).find("tbody tr, tr").length;
    score += Math.min(rowCount / 10, 3);

    if (score > bestScore) {
      bestScore = score;
      best = $(el);
    }
  });

  return bestScore >= 4 ? best : null;
}

export async function scrapeGeneric(url: string): Promise<ScrapePreview> {
  const hostname = new URL(url).hostname.replace(/^www\./, "");

  const resp = await axios.get(url, { headers: HEADERS, timeout: 15000 });
  const html = resp.data as string;

  const textLength = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
  if (textLength < 500) {
    throw new Error(
      `The page at ${hostname} appears to be JavaScript-rendered and cannot be scraped with this tool. ` +
      `Try downloading the results as CSV and pasting them manually.`
    );
  }

  const $ = cheerio.load(html);

  const rawTitle = $("title").text().trim() || $("h1").first().text().trim();
  const raceName = rawTitle || null;

  const pageText = $("body").text();
  const dateMatch = pageText.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}/i);
  const raceDate = dateMatch ? dateMatch[0] : null;

  const results: ScrapedResult[] = [];
  const table = bestTable($);

  if (!table) {
    throw new Error(
      `No results table was found on ${hostname}. The page structure may not be supported. ` +
      `Try using the manual entry form instead.`
    );
  }

  const headers: string[] = [];
  table.find("tr:first-child th, thead tr th, tr:first-child td").each((_, th) => {
    headers.push($(th).text().trim());
  });

  const rankIdx    = headers.findIndex(h => colMatch(h, RANK_KEYS));
  const nameIdx    = headers.findIndex(h => colMatch(h, NAME_KEYS));
  const firstIdx   = headers.findIndex(h => h.toLowerCase().trim() === "first" || h.toLowerCase().includes("first name"));
  const lastIdx    = headers.findIndex(h => h.toLowerCase().trim() === "last" || h.toLowerCase().includes("last name") || h.toLowerCase() === "surname");
  const timeIdx    = headers.findIndex(h => colMatch(h, TIME_KEYS));
  const genderIdx  = headers.findIndex(h => colMatch(h, GENDER_KEYS));
  const countryIdx = headers.findIndex(h => colMatch(h, COUNTRY_KEYS));
  const ageIdx     = headers.findIndex(h => colMatch(h, AGE_KEYS));
  const catIdx     = headers.findIndex(h => colMatch(h, CAT_KEYS));

  table.find("tbody tr, tr").slice(1).each((_, row) => {
    const cells: string[] = [];
    $(row).find("td").each((_, td) => { cells.push($(td).text().trim()); });
    if (cells.length < 2) return;

    const rankStr = rankIdx >= 0 ? cells[rankIdx] ?? "" : cells[0] ?? "";
    const isDnf = cells.some(c => c.toUpperCase() === "DNF" || c.toUpperCase().includes("DNF"));

    let name: string;
    if (firstIdx >= 0 && lastIdx >= 0 && cells[firstIdx] && cells[lastIdx]) {
      name = `${cells[firstIdx]} ${cells[lastIdx]}`.trim();
    } else if (nameIdx >= 0) {
      name = cells[nameIdx] ?? "";
    } else {
      name = cells[1] ?? "";
    }
    name = name.trim();
    if (!name || name.length < 2) return;

    const position = isDnf ? null : (parseInt(rankStr, 10) || null);
    const timeStr  = timeIdx >= 0 ? cells[timeIdx] ?? "" : "";
    const finishTimeSeconds = parseTimeToSeconds(timeStr);
    const genderRaw = genderIdx >= 0 ? (cells[genderIdx] ?? "").trim().toUpperCase() : null;
    const gender = genderRaw === "M" || genderRaw === "F" || genderRaw === "X" ? genderRaw : null;
    const country = countryIdx >= 0 ? cells[countryIdx]?.trim() || null : null;

    // Birth year / age
    let birthYear: number | null = null;
    if (ageIdx >= 0) {
      const raw = cells[ageIdx] ?? "";
      birthYear = parseBirthYear(raw);
      if (!birthYear) {
        const age = parseInt(raw, 10);
        if (!isNaN(age) && age > 0 && age < 120) birthYear = birthYearFromAge(age);
      }
    }

    const ageCategory = catIdx >= 0 ? normalizeAgeCategory(cells[catIdx] ?? "") : null;

    results.push({ runnerName: name, position, finishTimeSeconds, gender, country, dnf: isDnf, birthYear, ageCategory });
  });

  return {
    raceName,
    raceDate,
    raceLocation: null,
    source: hostname,
    url,
    totalFound: results.length,
    results,
  };
}
