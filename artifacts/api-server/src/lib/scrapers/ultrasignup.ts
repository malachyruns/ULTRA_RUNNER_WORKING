import axios from "axios";
import * as cheerio from "cheerio";
import type { ScrapePreview, ScrapedResult } from "./types";
import { parseTimeToSeconds } from "./types";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; UltraRank/1.0; +https://ultrarank.run)",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export function isUltraSignupUrl(url: string): boolean {
  return url.includes("ultrasignup.com");
}

export async function scrapeUltraSignup(url: string): Promise<ScrapePreview> {
  const resp = await axios.get(url, { headers: HEADERS, timeout: 15000 });
  const $ = cheerio.load(resp.data as string);

  // Race name from title or h1
  const rawTitle = $("title").text().trim() || $("h1").first().text().trim();
  const raceName = rawTitle.replace(/\s*[-|]?\s*UltraSignup.*$/i, "").trim() || null;

  // Try to find date in page text
  const pageText = $("body").text();
  const dateMatch = pageText.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i);
  const raceDate = dateMatch ? dateMatch[0] : null;

  const raceLocation = $(".event-location, .location").first().text().trim() || null;

  const results: ScrapedResult[] = [];

  // UltraSignup results table: columns vary but Place, First, Last, Gender, Time are common
  $("table").each((_, table) => {
    const headers: string[] = [];
    $(table).find("thead tr th, tr:first-child th, tr:first-child td").each((_, th) => {
      headers.push($(th).text().trim().toLowerCase());
    });

    // Check if this looks like a results table
    const hasPlace = headers.some(h => h.includes("place") || h.includes("rank") || h === "#");
    const hasName = headers.some(h => h.includes("name") || h.includes("first") || h.includes("last"));
    if (!hasPlace && !hasName) return;

    const placeIdx = headers.findIndex(h => h.includes("place") || h.includes("rank") || h === "#");
    const firstIdx = headers.findIndex(h => h.includes("first"));
    const lastIdx = headers.findIndex(h => h.includes("last"));
    const nameIdx = headers.findIndex(h => h === "name" || h === "runner");
    const genderIdx = headers.findIndex(h => h.includes("gender") || h.includes("sex") || h === "g" || h === "m/f");
    const timeIdx = headers.findIndex(h => h.includes("time") || h.includes("finish") || h === "gun");
    const natIdx = headers.findIndex(h => h.includes("state") || h.includes("country") || h.includes("nat"));

    $(table).find("tbody tr, tr").slice(1).each((_, row) => {
      const cells: string[] = [];
      $(row).find("td").each((_, td) => { cells.push($(td).text().trim()); });
      if (cells.length < 2) return;

      const placeStr = placeIdx >= 0 ? cells[placeIdx] : "";
      const isDnf = placeStr.toUpperCase().includes("DNF") || cells.some(c => c.toUpperCase() === "DNF");

      let name: string;
      if (firstIdx >= 0 && lastIdx >= 0) {
        name = `${cells[firstIdx] ?? ""} ${cells[lastIdx] ?? ""}`.trim();
      } else if (nameIdx >= 0) {
        name = cells[nameIdx] ?? "";
      } else {
        // Fallback: second cell is often name
        name = cells[1] ?? "";
      }
      name = name.trim();
      if (!name) return;

      const position = isDnf ? null : (parseInt(placeStr, 10) || null);
      const timeStr = timeIdx >= 0 ? cells[timeIdx] : "";
      const finishTimeSeconds = isDnf ? null : parseTimeToSeconds(timeStr);
      const gender = genderIdx >= 0 ? cells[genderIdx]?.trim().toUpperCase() || null : null;
      const country = natIdx >= 0 ? cells[natIdx]?.trim() || null : null;

      results.push({ runnerName: name, position, finishTimeSeconds, gender, country, dnf: isDnf });
    });
  });

  return {
    raceName,
    raceDate,
    raceLocation,
    source: "UltraSignup",
    url,
    totalFound: results.length,
    results,
  };
}
