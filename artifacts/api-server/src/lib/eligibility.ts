export const MIN_ULTRA_DISTANCE_KM = 50;

export interface EventEligibilityInput {
  distance?: number | string | null;
  distanceUnits?: string | null;
  eventType?: string | null;
  name?: string | null;
  requireRunningEventType?: boolean;
}

export interface EligibilityDecision {
  eligible: boolean;
  normalizedDistanceKm: number | null;
  category: string | null;
  reason: string | null;
}

export function evaluateRankingEligibility(input: EventEligibilityInput): EligibilityDecision {
  const value = typeof input.distance === "string" ? Number.parseFloat(input.distance) : input.distance;
  if (!value || !Number.isFinite(value) || value <= 0) {
    return { eligible: false, normalizedDistanceKm: null, category: null, reason: "Missing fixed distance" };
  }
  const distanceText = typeof input.distance === "string" ? input.distance : "";
  const compactDistance = distanceText.trim();
  const embeddedUnits = /^\d+(?:\.\d+)?\s*m$/.test(compactDistance) ? "meters"
    : /^\d+(?:\.\d+)?\s*M$/.test(compactDistance) ? "miles"
      : /^\d+(?:\.\d+)?\s*(?:k|K|km|KM)$/.test(compactDistance) ? "km"
        : /^\d+(?:\.\d+)?\s*(?:mi|mile|miles)$/i.test(compactDistance) ? "miles"
        : /\b(meters?|metres?)\b/i.test(distanceText) ? "meters"
          : /\b(km|kilometers?|kilometres?)\b/i.test(distanceText) ? "km"
            : /\b(mi|mile|miles)\b/i.test(distanceText) ? "miles" : undefined;
  const units = (input.distanceUnits ?? embeddedUnits)?.trim();
  if (!units) {
    return { eligible: false, normalizedDistanceKm: null, category: null, reason: "Distance units are missing or ambiguous" };
  }
  const distanceKm = units === "m" || /^(meters?|metres?)$/i.test(units) ? value / 1000
    : units === "M" || /^(mi|mile|miles)$/i.test(units) ? value * 1.609344
      : /^(k|K|km|KM|kilometers?|kilometres?)$/i.test(units) ? value
        : null;
  if (distanceKm === null) {
    return { eligible: false, normalizedDistanceKm: null, category: null, reason: `Unsupported distance units: ${units}` };
  }
  const eventType = (input.eventType ?? "").toLowerCase();
  const name = (input.name ?? "").toLowerCase();
  if (input.requireRunningEventType) {
    const normalizedEventType = eventType.replace(/[ -]+/g, "_");
    const runningTypes = new Set(["running", "running_race", "running_only", "trail_race", "open_course_trail", "ultra"]);
    if (!runningTypes.has(normalizedEventType)) {
      return { eligible: false, normalizedDistanceKm: distanceKm, category: null, reason: `Event type is not explicitly running: ${eventType || "missing"}` };
    }
  }
  if (/virtual|relay|stage|timed|hour|day|swim|cycling|bike|triathlon|duathlon/.test(`${eventType} ${name}`)) {
    return { eligible: false, normalizedDistanceKm: distanceKm, category: null, reason: "Not an individual fixed-distance event" };
  }
  if (distanceKm + 0.001 < MIN_ULTRA_DISTANCE_KM) {
    return { eligible: false, normalizedDistanceKm: distanceKm, category: null, reason: "Distance is below 50 km" };
  }
  const category = distanceKm >= 320 ? "200mi" : distanceKm >= 160 ? "100mi" : distanceKm >= 100 ? "100k" : distanceKm >= 80 ? "50mi" : "50k";
  return { eligible: true, normalizedDistanceKm: distanceKm, category, reason: null };
}
