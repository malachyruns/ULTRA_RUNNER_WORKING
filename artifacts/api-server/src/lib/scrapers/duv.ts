import axios from "axios";
import * as cheerio from "cheerio";
import type { ScrapePreview, ScrapedResult } from "./types";
import { parseTimeToSeconds, parseBirthYear, birthYearFromAge, normalizeAgeCategory } from "./types";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; UltraRank/1.0; +https://ultrarank.run)",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export function isDuvUrl(url: string): boolean {
  return url.includes("statistik.d-u-v.org") || url.includes("d-u-v.org");
}

export async function scrapeDuv(url: string): Promise<ScrapePreview> {
  const resp = await axios.get(url, { headers: HEADERS, timeout: 15000 });
  const $ = cheerio.load(resp.data as string);

  const rawTitle = $("title").text().trim() || $("h1, h2").first().text().trim();
  const raceName = rawTitle.replace(/DUV.*$/i, "").trim() || null;

  const pageText = $("body").text();
  const dateMatch = pageText.match(/\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4}/);
  const raceDate = dateMatch ? dateMatch[0] : null;
  const raceLocation = $("td:contains('Place'), th:contains('Place')").next().first().text().trim() || null;

  const results: ScrapedResult[] = [];

  // DUV columns: Rank, Perf, Name, Club, Nat, YOB, Sex, (Cat)
  $("table").each((_, table) => {
    const headers: string[] = [];
    $(table).find("tr:first-child th, tr:first-child td").each((_, th) => {
      headers.push($(th).text().trim().toLowerCase());
    });

    const hasRank = headers.some(h => h.includes("rank") || h === "pl" || h === "pos" || h === "#");
    const hasPerf = headers.some(h => h.includes("perf") || h.includes("time") || h.includes("result"));
    if (!hasRank && !hasPerf) return;

    const rankIdx   = headers.findIndex(h => h.includes("rank") || h === "pl" || h === "pos" || h === "#");
    const perfIdx   = headers.findIndex(h => h.includes("perf") || h.includes("time") || h.includes("result"));
    const nameIdx   = headers.findIndex(h => h.includes("name") || h.includes("athlete") || h.includes("runner"));
    const natIdx    = headers.findIndex(h => h.includes("nat") || h.includes("country") || h.includes("ctry"));
    const sexIdx    = headers.findIndex(h => h === "sex" || h === "gender" || h === "m/f" || h === "g");
    // DUV commonly has "YOB" (Year Of Birth) and "Cat" (age category like "M40")
    const yobIdx    = headers.findIndex(h => h === "yob" || h.includes("birth") || h === "born" || h === "year");
    const catIdx    = headers.findIndex(h => h === "cat" || h === "category" || h === "ag" || h === "class");

    $(table).find("tbody tr, tr").slice(1).each((_, row) => {
      const cells: string[] = [];
      $(row).find("td").each((_, td) => { cells.push($(td).text().trim()); });
      if (cells.length < 2) return;

      const rankStr = rankIdx >= 0 ? cells[rankIdx] ?? "" : cells[0] ?? "";
      const isDnf = rankStr.toUpperCase().includes("DNF") ||
        cells.some(c => c.toUpperCase() === "DNF");

      const nameRaw = nameIdx >= 0 ? cells[nameIdx] ?? "" : cells[2] ?? "";
      const name = nameRaw.trim();
      if (!name) return;

      const position = isDnf ? null : (parseInt(rankStr, 10) || null);
      const timeStr  = perfIdx >= 0 ? cells[perfIdx] ?? "" : "";
      const finishTimeSeconds = isDnf ? null : parseTimeToSeconds(timeStr);
      const nat = natIdx >= 0 ? cells[natIdx]?.trim() || null : null;
      const sexRaw = sexIdx >= 0 ? cells[sexIdx]?.trim().toUpperCase() : null;
      const gender = sexRaw === "M" || sexRaw === "F" || sexRaw === "W"
        ? (sexRaw === "W" ? "F" : sexRaw)
        : null;

      // Year of birth (DUV exports this directly as a 4-digit year)
      let birthYear: number | null = null;
      if (yobIdx >= 0) {
        const raw = cells[yobIdx] ?? "";
        birthYear = parseBirthYear(raw);
        // Fallback: if it looks like an age
        if (!birthYear) {
          const age = parseInt(raw, 10);
          if (!isNaN(age) && age > 0 && age < 120) birthYear = birthYearFromAge(age);
        }
      }

      // Age category (DUV uses "M40", "W50", "M-JUN", etc.)
      const ageCategory = catIdx >= 0 ? normalizeAgeCategory(cells[catIdx] ?? "") : null;

      results.push({ runnerName: name, position, finishTimeSeconds, gender, country: nat, dnf: isDnf, birthYear, ageCategory });
    });
  });

  return {
    raceName,
    raceDate,
    raceLocation,
    source: "DUV Ultramarathon Statistics",
    url,
    totalFound: results.length,
    results,
  };
}
