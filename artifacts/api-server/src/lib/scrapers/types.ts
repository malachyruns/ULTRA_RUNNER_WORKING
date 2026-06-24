export interface ScrapedResult {
  runnerName: string;
  country?: string | null;
  gender?: string | null;
  position?: number | null;
  finishTimeSeconds?: number | null;
  dnf?: boolean;
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
