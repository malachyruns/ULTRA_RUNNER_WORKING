/**
 * Difficulty scoring engine + Elo rating system.
 *
 * Difficulty score — multiplicative multiplier ≥ 1.0:
 *   score = surface × elevation × weather × technicality
 *
 * Elo rating — pairwise comparison across every runner in a field:
 *   For each pair (A, B): delta = K × (actual − expected)
 *   where expected = 1 / (1 + 10^((Rb − Ra) / 400))
 *   K scales with race difficulty and is normalized by √(fieldSize)
 *   so large fields don't cause runaway swings.
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

function elevationFactor(totalElevationM: number | null | undefined, distanceKm: number): number {
  if (!totalElevationM || distanceKm === 0) return 1.0;
  const vertRatio = (totalElevationM / distanceKm) * 100;
  return 1.0 + (vertRatio / 1000) * 0.08;
}

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
  return Math.round(sf * ef * wf * tf * 1000) / 1000;
}

// ─── Elo engine ───────────────────────────────────────────────────────────────

/**
 * One entry in the race field, used by computeEloChanges.
 */
export interface FieldEntry {
  runnerId: number;
  /** Rating BEFORE this race — must be a snapshot, not updated mid-loop. */
  rating: number;
  position: number | null;
  dnf: boolean;
}

/**
 * Compute pairwise Elo deltas for an entire race field.
 *
 * Rules:
 *  - Lower position number = better finish (1st place beats 2nd place)
 *  - DNF loses against all finishers, ties with other DNFs
 *  - Missing position (no timing data) treated as a draw
 *
 * K per matchup = (BASE_K × difficultyScore) / √(fieldSize)
 *   → difficulty 1.0, 100 runners: K ≈ 3.2 per match, max swing ≈ ±320 pts
 *   → difficulty 3.5, 20 runners:  K ≈ 25  per match, max swing ≈ ±475 pts
 *
 * Returns Map<runnerId, delta> where delta can be positive or negative.
 */
export function computeEloChanges(
  field: FieldEntry[],
  difficultyScore: number,
  BASE_K = 32,
): Map<number, number> {
  const deltas = new Map<number, number>();
  for (const e of field) deltas.set(e.runnerId, 0);

  if (field.length < 2) return deltas;

  const K = (BASE_K * difficultyScore) / Math.sqrt(field.length);

  for (let i = 0; i < field.length; i++) {
    const a = field[i];
    for (let j = i + 1; j < field.length; j++) {
      const b = field[j];

      // Expected probability that A beats B given pre-race ratings
      const eA = 1 / (1 + Math.pow(10, (b.rating - a.rating) / 400));
      const eB = 1 - eA;

      // Actual result for A
      let sA: number;
      if (a.dnf && b.dnf) {
        sA = 0.5;                                   // both DNF → draw
      } else if (a.dnf) {
        sA = 0;                                     // A DNF, B finished → A loses
      } else if (b.dnf) {
        sA = 1;                                     // A finished, B DNF → A wins
      } else if (a.position === null || b.position === null) {
        sA = 0.5;                                   // no timing data → draw
      } else {
        sA = a.position < b.position ? 1           // A higher place
           : a.position > b.position ? 0           // A lower place
           : 0.5;                                   // tied
      }

      deltas.set(a.runnerId, (deltas.get(a.runnerId) ?? 0) + K * (sA - eA));
      deltas.set(b.runnerId, (deltas.get(b.runnerId) ?? 0) + K * ((1 - sA) - eB));
    }
  }

  // Round to 1 decimal place
  for (const [id, d] of deltas) deltas.set(id, Math.round(d * 10) / 10);

  return deltas;
}

/** Endurance level: winner's time / runner's time × 1000. */
export function computeEnduranceLevel(
  winnerTimeSeconds: number | null | undefined,
  runnerTimeSeconds: number | null | undefined,
): number {
  if (!winnerTimeSeconds || !runnerTimeSeconds || runnerTimeSeconds <= 0) return 0;
  return Math.round((winnerTimeSeconds / runnerTimeSeconds) * 1000 * 10) / 10;
}
