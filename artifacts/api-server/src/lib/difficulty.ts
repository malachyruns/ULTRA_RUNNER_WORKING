/**
 * Difficulty scoring engine.
 *
 * Produces a multiplier (≥ 1.0) that scales the points awarded for a race.
 * A flat road 50K in clear weather scores 1.0.
 * A mountain 100-miler in a storm with max technicality scores ~3.5.
 *
 * Formula (multiplicative):
 *   score = surface × elevation × weather × technicality
 */

type Surface = "trail" | "road" | "mountain" | "mixed";
type Weather = "clear" | "rain" | "heat" | "snow" | "storm" | null | undefined;

const SURFACE_FACTOR: Record<Surface, number> = {
  road: 1.0,
  trail: 1.2,
  mixed: 1.35,
  mountain: 1.55,
};

const WEATHER_FACTOR: Record<string, number> = {
  clear: 1.0,
  rain: 1.12,
  heat: 1.15,
  snow: 1.22,
  storm: 1.35,
};

/**
 * Elevation factor: adds 0.08 per 1 000 m of gain per 100 km.
 * A race with 10 000 m gain over 170 km ≈ +0.47
 */
function elevationFactor(totalElevationM: number | null | undefined, distanceKm: number): number {
  if (!totalElevationM || distanceKm === 0) return 1.0;
  const vertRatio = (totalElevationM / distanceKm) * 100; // m gain per 100 km
  return 1.0 + (vertRatio / 1000) * 0.08;
}

/**
 * Technicality factor: rating 1–5 maps linearly to 1.0–1.45.
 */
function technicalityFactor(rating: number | null | undefined): number {
  if (!rating) return 1.0;
  const clamped = Math.max(1, Math.min(5, rating));
  return 1.0 + ((clamped - 1) / 4) * 0.45;
}

export function computeDifficultyScore(opts: {
  surface: string;
  totalElevationM?: number | null;
  distanceKm: number;
  weatherConditions?: Weather;
  technicalityRating?: number | null;
}): number {
  const sf = SURFACE_FACTOR[opts.surface as Surface] ?? 1.0;
  const ef = elevationFactor(opts.totalElevationM, opts.distanceKm);
  const wf = WEATHER_FACTOR[opts.weatherConditions ?? "clear"] ?? 1.0;
  const tf = technicalityFactor(opts.technicalityRating);

  const raw = sf * ef * wf * tf;
  return Math.round(raw * 1000) / 1000;
}

/**
 * Points awarded to a single finisher.
 * Base points scale with position (1st = 1000, decays).
 * All points are then multiplied by the race difficulty score.
 */
export function computePoints(opts: {
  position: number | null | undefined;
  dnf: boolean;
  totalFinishers: number;
  difficultyScore: number;
}): number {
  if (opts.dnf || !opts.position) return 0;
  const base = 1000;
  const decay = Math.max(0, 1 - (opts.position - 1) / Math.max(opts.totalFinishers, 1));
  const raw = base * decay * opts.difficultyScore;
  return Math.round(raw * 10) / 10;
}
