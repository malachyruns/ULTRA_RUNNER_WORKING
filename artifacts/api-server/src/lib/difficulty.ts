/**
 * Difficulty scoring engine + rating system.
 *
 * Difficulty score — multiplicative multiplier ≥ 1.0:
 *   score = surface × elevation × weather × technicality
 *
 * Rating system — for each pair of runners in a race field, we compute a
 * continuous, TIME-BASED performance score (not just win/loss), blended
 * with a placement-based bonus that matters near the front of the field
 * and fades to nothing further back. This means:
 *   - A close finish against a stronger opponent earns real credit even
 *     if you technically lost — placement alone can't tell "barely lost"
 *     from "blown out," but time gap can.
 *   - The outright winner (and other top finishers) get extra credit for
 *     the placement itself, on top of their time.
 *   - A runner finishing well back in the field is scored almost purely
 *     on their time relative to the field — a strong relative performance
 *     is never diluted just because they placed low.
 *   - A uniformly fast or slow day for the whole field (weather, course
 *     conditions) doesn't move anyone's rating — everything is relative
 *     to that day's own time spread, not absolute times.
 *
 * The result of computeEloChanges is NOT a ready-to-apply delta — it's two
 * separate signals per runner (an "implied rating" for potential gains, and
 * a conventional weighted delta for losses), which pipeline.ts combines
 * with confidence-weighting, confirmation-gating, and capping. This split
 * exists because solving the rating formula "backwards" from a bad result
 * produces mathematically unstable, unbounded numbers — it's only safe to
 * use for genuine breakout GAINS, never for losses.
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

// ─── Rating engine ──────────────────────────────────────────────────────────

export interface FieldEntry {
  runnerId: number;
  /** Rating BEFORE this race — must be a snapshot, not updated mid-loop. */
  rating: number;
  position: number | null;
  dnf: boolean;
  finishTimeSeconds: number | null;
}

export interface RunnerSignal {
  /** What rating this ONE result implies, if trusted fully — used for gains only. */
  impliedRating: number;
  /** A conventional, proximity-weighted delta (as a %) — used for losses. */
  standardDeltaPct: number;
}

const ELO_DIVISOR = 20000;
const PROXIMITY_SCALE = 3000;

/** Continuous, time-gap-based score between two runners — NOT placement-based. */
function timeScore(timeA: number | null, timeB: number | null, stdDev: number): number {
  if (timeA == null || timeB == null) return 0.5;
  const diff = timeB - timeA; // positive = A was faster
  return 1 / (1 + Math.exp(-diff / stdDev));
}

function positionScore(posA: number | null, posB: number | null): number {
  if (posA == null || posB == null) return 0.5;
  if (posA < posB) return 1.0;
  if (posA > posB) return 0.0;
  return 0.5;
}

/**
 * How much placement should influence the score, based on how near the
 * front of the field a runner finished. Full weight for the outright
 * winner, tapering linearly to zero by the halfway point of the field —
 * below that, scoring is purely time-based.
 */
function placementBlendWeight(position: number | null, fieldSize: number): number {
  if (position == null || fieldSize <= 1) return 0;
  const percentile = (position - 1) / (fieldSize - 1); // 0 = winner, 1 = last
  return Math.max(0, 1 - 2 * percentile);
}

/** The blended score for A vs B, combining time and (near-the-front-only) placement. */
function blendedScore(a: FieldEntry, b: FieldEntry, stdDev: number, fieldSize: number): number {
  if (a.dnf && b.dnf) return 0.5;
  if (a.dnf) return 0.0;
  if (b.dnf) return 1.0;

  const tScore = timeScore(a.finishTimeSeconds, b.finishTimeSeconds, stdDev);
  const pScore = positionScore(a.position, b.position);
  const weight = placementBlendWeight(a.position, fieldSize);
  return (1 - weight) * tScore + weight * pScore;
}

export function computeEloChanges(
  field: FieldEntry[],
  _difficultyScore: number, // reserved for future difficulty-scaling; not used in the current formula
): Map<number, RunnerSignal> {
  const signals = new Map<number, RunnerSignal>();
  if (field.length < 2) {
    for (const e of field) signals.set(e.runnerId, { impliedRating: e.rating, standardDeltaPct: 0 });
    return signals;
  }

  const finishers = field.filter(e => !e.dnf && e.finishTimeSeconds != null);
  const times = finishers.map(e => e.finishTimeSeconds!);
  const mean = times.reduce((a, b) => a + b, 0) / (times.length || 1);
  const variance = times.reduce((a, b) => a + (b - mean) ** 2, 0) / (times.length || 1);
  const stdDev = (Math.sqrt(variance) || 1) * 0.6;

  const K = 45 / (field.length - 1);

  for (let i = 0; i < field.length; i++) {
    const a = field[i];

    let impliedWeightedSum = 0;
    let impliedWeightTotal = 0;
    let stdWeightedSum = 0;
    let stdWeightTotal = 0;

    for (let j = 0; j < field.length; j++) {
      if (i === j) continue;
      const b = field[j];

      const sA = blendedScore(a, b, stdDev, field.length);
      const sAClamped = Math.min(0.98, Math.max(0.02, sA));

      // Backward-solve: what rating would make THIS result exactly expected
      // against B? Only meaningful/safe as a signal for GAINS.
      const impliedVsB = b.rating - ELO_DIVISOR * Math.log10(1 / sAClamped - 1);
      const closenessWeight = Math.min(1, Math.max(0.05, 1 - Math.abs(sA - 0.5) * 1.6));
      impliedWeightedSum += impliedVsB * closenessWeight;
      impliedWeightTotal += closenessWeight;

      // Conventional expected-vs-actual delta, weighted toward opponents
      // close in current rating — this is the safe, well-behaved path for LOSSES.
      const eA = 1 / (1 + Math.pow(10, (b.rating - a.rating) / ELO_DIVISOR));
      const gap = Math.abs(b.rating - a.rating);
      const proximityWeight = Math.exp(-gap / PROXIMITY_SCALE);
      stdWeightedSum += proximityWeight * (sA - eA);
      stdWeightTotal += proximityWeight;
    }

    const impliedRating = impliedWeightTotal > 0 ? impliedWeightedSum / impliedWeightTotal : a.rating;
    const normalizedStd = stdWeightTotal > 0 ? (stdWeightedSum / stdWeightTotal) * (field.length - 1) : 0;
    const standardDeltaPct = K * normalizedStd;

    signals.set(a.runnerId, { impliedRating, standardDeltaPct });
  }

  return signals;
}

/** Endurance level: winner's time / runner's time × 1000. Stored for display/stats — no longer used to scale rating changes directly, since the time-based scoring above already captures relative performance. */
export function computeEnduranceLevel(
  winnerTimeSeconds: number | null | undefined,
  runnerTimeSeconds: number | null | undefined,
): number {
  if (!winnerTimeSeconds || !runnerTimeSeconds || runnerTimeSeconds <= 0) return 0;
  return Math.round((winnerTimeSeconds / runnerTimeSeconds) * 1000 * 10) / 10;
}