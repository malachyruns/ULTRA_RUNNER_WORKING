import axios from "axios";
import * as cheerio from "cheerio";
import type { ScrapePreview, ScrapedResult } from "./types";
import {
  parseTimeToSeconds, parseBirthYear, birthYearFromAge, normalizeAgeCategory,
  parseDuvDate, countryNameFromCode,
} from "./types";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; UltraRank/1.0; +https://ultrarank.run)",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export function isDuvUrl(url: string): boolean {
  return url.includes("statistik.d-u-v.org") || url.includes("d-u-v.org");
}

/** Find the value cell next to a bold label like "Date:", "Event:", "Distance:" */
function labeledValue($: cheerio.CheerioAPI, label: string): string | null {
  let value: string | null = null;
  $("td, th").each((_, el) => {
    const text = $(el).text().trim();
    if (text.toLowerCase() === label.toLowerCase()) {
      const next = $(el).next("td");
      if (next.length) value = next.text().trim();
    }
  });
  return value;
}

export async function scrapeDuv(url: string): Promise<ScrapePreview> {
  const resp = await axios.get(url, { headers: HEADERS, timeout: 15000 });
  const $ = cheerio.load(resp.data as string);

  // ── Race metadata, read from DUV's labeled info table ──────────────────────
  const rawDate = labeledValue($, "Date:");
  const raceDate = rawDate ? parseDuvDate(rawDate) ?? rawDate : null;

  const rawEvent = labeledValue($, "Event:");
  let raceName: string | null = null;
  let raceCountryCode: string | null = null;
  let raceCountry: string | null = null;
  if (rawEvent) {
    // Strip a trailing country code in parens, e.g. "... (GER)"
    const countryMatch = rawEvent.match(/\(([A-Z]{2,3})\)\s*$/);
    let nameOnly = rawEvent;
    if (countryMatch) {
      raceCountryCode = countryMatch[1];
      raceCountry = countryNameFromCode(countryMatch[1]);
      nameOnly = rawEvent.slice(0, countryMatch.index).trim();
    }
    // Strip a leading ordinal number, e.g. "1 Rund um Fehmarn Ultra" → "Rund um Fehmarn Ultra"
    nameOnly = nameOnly.replace(/^\d+\s+/, "").trim();
    raceName = nameOnly || null;
  }

  // Fallback to old title-based method only if the labeled row wasn't found
  if (!raceName) {
    const rawTitle = $("title").text().trim() || $("h1, h2").first().text().trim();
    raceName = rawTitle.replace(/^DUV[\s\-:]*/i, "").trim() || null;
  }

  const rawDistance = labeledValue($, "Distance:");
  let raceDistanceKm: number | null = null;
  let raceSurface: string | null = null;
  if (rawDistance) {
    const kmMatch = rawDistance.match(/(\d+(?:\.\d+)?)\s*km/i);
    if (kmMatch) raceDistanceKm = parseFloat(kmMatch[1]);
    const lower = rawDistance.toLowerCase();
    if (lower.includes("trail")) raceSurface = "trail";
    else if (lower.includes("road")) raceSurface = "road";
    else if (lower.includes("mountain")) raceSurface = "mountain";
  }

  // Location isn't labeled directly on this page — DUV tucks it into the
  // "email this page" link's body text: "<race name>, <location>, <date>"
  let raceLocation: string | null = null;
  const mailtoHref = $("a[href^='mailto:']").first().attr("href") ?? "";
  const bodyMatch = mailtoHref.match(/body=([^&]+)/);
  if (bodyMatch) {
    try {
      const decoded = decodeURIComponent(bodyMatch[1]);
      const lines = decoded.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const infoLine = lines.find(l => /\d{1,2}\.\d{1,2}\.\d{4}\s*$/.test(l));
      if (infoLine) {
        const parts = infoLine.split(",").map(p => p.trim());
        if (parts.length >= 3) {
          raceLocation = parts.slice(1, parts.length - 1).join(", ");
        }
      }
    } catch {
      // ignore malformed mailto content
    }
  }

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
    const yobIdx    = headers.findIndex(h => h === "yob" || h.includes("birth") || h === "born" || h === "year");
    const catIdx    = headers.findIndex(h => h === "cat" || h === "category" || h === "ag" || h === "class");

    $(table).find("tbody tr, tr").slice(1).each((_, row) => {
      const cells: string[] = [];
      $(row).find("td").each((_, td) => { cells.push($(td).text().trim()); });
      if (cells.length < 2) return;

      const rankStr = rankIdx >= 0 ? cells[rankIdx] ?? "" : cells[0] ?? "";
      const timeStr  = perfIdx >= 0 ? cells[perfIdx] ?? "" : "";

      const isDnf = rankStr.toUpperCase().includes("DNF") ||
        timeStr.toUpperCase().includes("DNF") ||
        timeStr.toUpperCase().includes("DNS") ||
        timeStr.toUpperCase().includes("DSQ") ||
        cells.some(c => ["DNF", "DNS", "DSQ"].includes(c.toUpperCase()));

      const nameRaw = nameIdx >= 0 ? cells[nameIdx] ?? "" : cells[2] ?? "";
      const name = nameRaw.trim();
      if (!name) return;

      const position = isDnf ? null : (parseInt(rankStr, 10) || null);
      const finishTimeSeconds = isDnf ? null : parseTimeToSeconds(timeStr);
      const nat = natIdx >= 0 ? cells[natIdx]?.trim() || null : null;
      const sexRaw = sexIdx >= 0 ? cells[sexIdx]?.trim().toUpperCase() : null;
      const gender = sexRaw === "M" || sexRaw === "F" || sexRaw === "W"
        ? (sexRaw === "W" ? "F" : sexRaw)
        : null;

      let birthYear: number | null = null;
      if (yobIdx >= 0) {
        const raw = cells[yobIdx] ?? "";
        birthYear = parseBirthYear(raw);
        if (!birthYear) {
          const age = parseInt(raw, 10);
          if (!isNaN(age) && age > 0 && age < 120) birthYear = birthYearFromAge(age);
        }
      }

      const ageCategory = catIdx >= 0 ? normalizeAgeCategory(cells[catIdx] ?? "") : null;

      results.push({ runnerName: name, position, finishTimeSeconds, gender, country: nat, dnf: isDnf, birthYear, ageCategory });
    });
  });

  return {
    raceName,
    raceDate,
    raceLocation,
    raceCountry,
    raceCountryCode,
    raceDistanceKm,
    raceSurface,
    source: "DUV Ultramarathon Statistics",
    url,
    totalFound: results.length,
    results,
  };
}