export interface ScrapedResult {
  runnerName: string;
  country?: string | null;
  gender?: string | null;
  position?: number | null;
  finishTimeSeconds?: number | null;
  dnf?: boolean;
  /** Four-digit birth year, e.g. 1985 */
  birthYear?: number | null;
  /** Age category label, e.g. "M40", "F50-59", "Senior" */
  ageCategory?: string | null;
  sourceRunnerId?: string | null;
  sourceResultId?: string | null;
  sourceRegistrationId?: string | null;
  sourceModifiedAt?: Date | null;
}

export interface ScrapePreview {
  raceName: string | null;
  raceDate: string | null;
  raceLocation: string | null;
  raceCountry?: string | null;
  raceCountryCode?: string | null;
  raceDistanceKm?: number | null;
  raceSurface?: string | null;
  source: string;
  url: string;
  totalFound: number;
  results: ScrapedResult[];
}

/** Parse time strings like "23:45:12", "1:23:45:12" (d:h:m:s), "1d 23:45:12", "10:23:45 h" to seconds */
export function parseTimeToSeconds(raw: string): number | null {
  if (!raw || raw.trim() === "") return null;
  let s = raw.trim().toUpperCase();

  if (s === "DNF" || s === "DNS" || s === "DSQ" || s === "--" || s === "N/A") return null;

  s = s.replace(/\s*H(OURS)?\s*$/, "").trim();
  s = s.replace(/\s+/g, "");

  const dayMatch = s.match(/^(\d+)D(\d+):(\d+):(\d+)$/);
  if (dayMatch) {
    const [, d, h, m, sec] = dayMatch.map(Number);
    return d * 86400 + h * 3600 + m * 60 + sec;
  }

  const parts = s.split(":");
  if (parts.length === 4) {
    const [d, h, m, sec] = parts.map(Number);
    if (!parts.some(v => isNaN(Number(v)))) return d * 86400 + h * 3600 + m * 60 + sec;
  }
  if (parts.length === 3) {
    const [h, m, sec] = parts.map(Number);
    if (!parts.some(p => isNaN(Number(p)))) return h * 3600 + m * 60 + sec;
  }
  if (parts.length === 2) {
    const [m, sec] = parts.map(Number);
    if (!parts.some(p => isNaN(Number(p)))) return m * 60 + sec;
  }
  return null;
}

/**
 * Parse a birth-year or age string into a four-digit birth year.
 * Handles: "1985", "85" (ambiguous, treated as 19xx), "42" (age → derive year).
 */
export function parseBirthYear(raw: string, currentYear = new Date().getFullYear()): number | null {
  if (!raw || raw.trim() === "") return null;
  const n = parseInt(raw.trim(), 10);
  if (isNaN(n)) return null;
  if (n >= 1900 && n <= currentYear) return n;
  if (n >= 0 && n <= 99) return 1900 + n;
  return null;
}

export function birthYearFromAge(age: number): number {
  return new Date().getFullYear() - age;
}

export function normalizeAgeCategory(raw: string): string | null {
  if (!raw || raw.trim() === "") return null;
  const s = raw.trim();
  const m = s.match(/^([MFX])\s*(\d{2})/i);
  if (m) return `${m[1].toUpperCase()}${m[2]}`;
  const r = s.match(/^(\d{2})/);
  if (r) return r[1];
  if (/^(senior|master|junior|open|elite|vet)/i.test(s)) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
  return s.length <= 10 ? s : null;
}

/** Convert "DD.MM.YYYY" (DUV's date format) to "YYYY-MM-DD" (ISO, what the frontend expects).
 *  DUV sometimes gives a date RANGE for multi-day races, e.g. "30.12.2025-01.01.2026" —
 *  in that case we use the start date. */
export function parseDuvDate(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim();

  // Multi-day range: take the first date only
  if (s.includes("-") && /\d{4}-\d{1,2}\.\d{1,2}\.\d{4}$/.test(s) === false) {
    const rangeMatch = s.match(/^(\d{1,2}\.\d{1,2}\.\d{4})-/);
    if (rangeMatch) s = rangeMatch[1];
  }

  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // already ISO
  return null;
}

/** Small lookup for the 3-letter country codes DUV uses next to race/event names */
const COUNTRY_CODE_MAP: Record<string, string> = {
  GER: "Germany", USA: "United States", FRA: "France", GBR: "United Kingdom",
  ITA: "Italy", ESP: "Spain", SUI: "Switzerland", AUT: "Austria",
  NED: "Netherlands", CAN: "Canada", AUS: "Australia", NZL: "New Zealand",
  JPN: "Japan", POL: "Poland", CZE: "Czech Republic", SWE: "Sweden",
  NOR: "Norway", DEN: "Denmark", FIN: "Finland", BEL: "Belgium",
  POR: "Portugal", IRL: "Ireland", RSA: "South Africa", BRA: "Brazil",
  MEX: "Mexico", ARG: "Argentina", CHN: "China", KOR: "South Korea",
  IND: "India", RUS: "Russia", UKR: "Ukraine", ROU: "Romania",
  BUL: "Bulgaria", CRO: "Croatia", SRB: "Serbia", SLO: "Slovenia",
  SVK: "Slovakia", HUN: "Hungary", GRE: "Greece", TUR: "Turkey", ISR: "Israel",
};

export function countryNameFromCode(code: string): string {
  return COUNTRY_CODE_MAP[code.toUpperCase()] ?? code;
}
