export function normalizeRunnerName(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export function runnerNameSimilarity(a: string, b: string): number {
  const left = normalizeRunnerName(a);
  const right = normalizeRunnerName(b);
  if (left === right) return 1;
  const bigrams = (s: string) => { const out = new Set<string>(); for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2)); return out; };
  const x = bigrams(left), y = bigrams(right);
  if (!x.size || !y.size) return 0;
  let overlap = 0; for (const item of x) if (y.has(item)) overlap++;
  return (2 * overlap) / (x.size + y.size);
}

export function cautiousNameMatch(a: string, b: string, sameBirthYear: boolean): boolean {
  const normalizedEqual = normalizeRunnerName(a) === normalizeRunnerName(b);
  return normalizedEqual || (sameBirthYear && runnerNameSimilarity(a, b) >= 0.85);
}

export function sameRaceResultsIndicateDistinctRunner(
  previousFinishTimeSeconds: number | null,
  currentFinishTimeSeconds: number | null,
  previousStableId?: string | null,
  currentStableId?: string | null,
): boolean {
  const differentTimes = previousFinishTimeSeconds !== null && currentFinishTimeSeconds !== null
    && previousFinishTimeSeconds !== currentFinishTimeSeconds;
  const differentStableIds = Boolean(previousStableId && currentStableId && previousStableId !== currentStableId);
  return differentTimes || differentStableIds;
}
