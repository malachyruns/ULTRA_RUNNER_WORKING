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
}

export interface ScrapePreview {
  raceName: string | null;
  raceDate: string | null;
  raceLocation: string | null;
  source: string;
  url: string;
  totalFound: number;
  results: ScrapedResult[];
}

/** Parse time strings like "23:45:12", "1:23:45:12" (d:h:m:s), "1d 23:45:12" to seconds */
export function parseTimeToSeconds(raw: string): number | null {
  if (!raw || raw.trim() === "" || raw === "DNF" || raw === "--") return null;
  const s = raw.trim().toUpperCase();

  // Format: "1D 23:45:12" (DUV day prefix)
  const dayMatch = s.match(/^(\d+)D\s+(\d+):(\d+):(\d+)$/);
  if (dayMatch) {
    const [, d, h, m, sec] = dayMatch.map(Number);
    return d * 86400 + h * 3600 + m * 60 + sec;
  }

  // Format: "1:23:45:12" (d:h:m:s)
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
  if (n >= 1900 && n <= currentYear) return n;          // Full year
  if (n >= 0 && n <= 99) return 1900 + n;              // Two-digit year
  return null;
}

/**
 * Derive birth year from an age integer (approximate — within 1 year).
 */
export function birthYearFromAge(age: number): number {
  return new Date().getFullYear() - age;
}

/**
 * Normalise an age-category string: "M40-49" → "M40", "F 50-59" → "F50", "Senior" → "Senior".
 * Returns null for empty/unknown values.
 */
export function normalizeAgeCategory(raw: string): string | null {
  if (!raw || raw.trim() === "") return null;
  const s = raw.trim();
  // Pattern: gender prefix + decade, e.g. "M40-49", "F40"
  const m = s.match(/^([MFX])\s*(\d{2})/i);
  if (m) return `${m[1].toUpperCase()}${m[2]}`;
  // No gender prefix but has age range, e.g. "40-49"
  const r = s.match(/^(\d{2})/);
  if (r) return r[1];
  // Named categories: Senior, Master, Junior, etc.
  if (/^(senior|master|junior|open|elite|vet)/i.test(s)) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
  return s.length <= 10 ? s : null;
}
