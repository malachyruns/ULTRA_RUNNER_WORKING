/**
 * Import pipeline — time-based, confidence-weighted rating system.
 */
import { db, racesTable, resultsTable, runnersTable } from "@workspace/db";
import { eq, and, inArray, or, sql } from "drizzle-orm";
import type { ScrapePreview, ScrapedResult } from "./scrapers/types";
import { computeEloChanges, computeEnduranceLevel, type FieldEntry } from "./difficulty";
import { logger } from "./logger";
import { cautiousNameMatch, normalizeRunnerName, sameRaceResultsIndicateDistinctRunner } from "./runnerMatching";

type RunnerRow = typeof runnersTable.$inferSelect;
export type RunnerImportCache = Map<string, RunnerRow>;

function cacheRunner(cache: RunnerImportCache | undefined, runner: RunnerRow, name: string, birthYear?: number | null, sourceRunnerId?: string | null) {
  if (!cache) return;
  if (sourceRunnerId) cache.set(`rs:${sourceRunnerId}`, runner);
  cache.set(`name:${normalizeRunnerName(name)}:${birthYear ?? ""}`, runner);
  if (cache.size > 100_000) cache.delete(cache.keys().next().value!);
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type JobStatus = "pending" | "running" | "done" | "error";

export interface ImportJob {
  id: string;
  status: JobStatus;
  processed: number;
  total: number;
  result?: ImportResult;
  error?: string;
  startedAt: Date;
  finishedAt?: Date;
}

export interface ImportResult {
  resultsCreated: number;
  runnersCreated: number;
  runnersUpdated: number;
  difficultyScore: number;
  source: string | null;
  raceName: string | null;
  duplicateResultsSkipped: number;
  runnerCollisionsSeparated: number;
}

// ─── Job registry ──────────────────────────────────────────────────────────────

const jobs = new Map<string, ImportJob>();

function makeJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getJob(id: string): ImportJob | undefined {
  return jobs.get(id);
}

function pruneOldJobs(): void {
  const cutoff = Date.now() - 30 * 60_000;
  for (const [id, job] of jobs) {
    if (job.startedAt.getTime() < cutoff) jobs.delete(id);
  }
}

// ─── Runner resolution helper ──────────────────────────────────────────────────

async function createRunner(
  name: string,
  birthYear: number | null | undefined,
  gender: string | null | undefined,
  country: string | null | undefined,
  ageCategory: string | null | undefined,
  sourceRunnerId?: string | null,
  cache?: RunnerImportCache,
): Promise<RunnerRow> {
  const currentYear = new Date().getFullYear();
  const age = birthYear ? currentYear - birthYear : null;
  const [newRunner] = await db.insert(runnersTable).values({
    name, country: country ?? "Unknown", gender: gender ?? "M", rating: "1000",
    ratingChange: "0", rank: 0, totalRaces: 0, totalDistanceKm: "0",
    birthYear: birthYear ?? null, ageCategory: ageCategory ?? null, age: age ?? null,
    runSignupId: sourceRunnerId ?? null,
  }).returning();
  cacheRunner(cache, newRunner, name, birthYear, sourceRunnerId);
  return newRunner;
}

async function resolveRunnersBatch(entries: ScrapedResult[], cache?: RunnerImportCache) {
  const sourceIds = [...new Set(entries.map(entry => entry.sourceRunnerId).filter(Boolean))] as string[];
  const birthYears = [...new Set(entries.map(entry => entry.birthYear).filter((value): value is number => Boolean(value)))];
  const lowercaseNames = [...new Set(entries.map(entry => entry.runnerName?.trim().toLowerCase()).filter(Boolean))] as string[];

  const cachedRows = [...new Set(entries.map(entry => {
    const name = entry.runnerName?.trim() ?? "";
    return cache?.get(entry.sourceRunnerId ? `rs:${entry.sourceRunnerId}` : `name:${normalizeRunnerName(name)}:${entry.birthYear ?? ""}`);
  }).filter((row): row is RunnerRow => Boolean(row)))];
  const sourceRows = sourceIds.length
    ? await db.select().from(runnersTable).where(inArray(runnersTable.runSignupId, sourceIds)) : [];
  const candidateConditions = [];
  if (birthYears.length) candidateConditions.push(inArray(runnersTable.birthYear, birthYears));
  if (lowercaseNames.length) candidateConditions.push(inArray(sql<string>`lower(${runnersTable.name})`, lowercaseNames));
  const candidateRows = candidateConditions.length
    ? await db.select().from(runnersTable).where(or(...candidateConditions)!) : [];
  const available = [...new Map([...cachedRows, ...sourceRows, ...candidateRows].map(row => [row.id, row])).values()];
  const bySource = new Map(available.filter(row => row.runSignupId).map(row => [row.runSignupId!, row]));
  const staged = new Map<string, typeof runnersTable.$inferInsert>();
  const assignments: Array<{ runner?: RunnerRow; stagedKey?: string; created: boolean }> = [];
  const claimedSourceIds = new Map<number, string>();
  const pendingRunnerUpdates = new Map<number, Partial<typeof runnersTable.$inferInsert>>();

  for (const entry of entries) {
    const name = entry.runnerName!.trim();
    const sourceMatch = entry.sourceRunnerId ? bySource.get(entry.sourceRunnerId) : undefined;
    const match = sourceMatch ?? available.find(row => {
      const claimed = claimedSourceIds.get(row.id);
      if (entry.sourceRunnerId && ((row.runSignupId && row.runSignupId !== entry.sourceRunnerId) || (claimed && claimed !== entry.sourceRunnerId))) return false;
      return entry.birthYear
        ? row.birthYear === entry.birthYear && cautiousNameMatch(row.name, name, true)
        : normalizeRunnerName(row.name) === normalizeRunnerName(name);
    });
    if (match) {
      const updates: Partial<typeof runnersTable.$inferInsert> = {};
      if (entry.sourceRunnerId && !match.runSignupId) {
        match.runSignupId = entry.sourceRunnerId;
        claimedSourceIds.set(match.id, entry.sourceRunnerId);
        updates.runSignupId = entry.sourceRunnerId;
        bySource.set(entry.sourceRunnerId, match);
      }
      if ((!match.country || match.country === "Unknown") && entry.country) updates.country = entry.country;
      if (!match.birthYear && entry.birthYear) updates.birthYear = entry.birthYear;
      if (!match.ageCategory && entry.ageCategory) updates.ageCategory = entry.ageCategory;
      if (Object.keys(updates).length) pendingRunnerUpdates.set(match.id, { ...pendingRunnerUpdates.get(match.id), ...updates });
      assignments.push({ runner: match, created: false });
      cacheRunner(cache, match, name, entry.birthYear, entry.sourceRunnerId);
      continue;
    }
    const stagedKey = entry.sourceRunnerId
      ? `rs:${entry.sourceRunnerId}`
      : `name:${normalizeRunnerName(name)}:${entry.birthYear ?? ""}`;
    const isNew = !staged.has(stagedKey);
    if (isNew) {
      const currentYear = new Date().getFullYear();
      staged.set(stagedKey, {
        name, country: entry.country ?? "Unknown", gender: entry.gender ?? "M", rating: "1000",
        ratingChange: "0", rank: 0, totalRaces: 0, totalDistanceKm: "0",
        birthYear: entry.birthYear ?? null, ageCategory: entry.ageCategory ?? null,
        age: entry.birthYear ? currentYear - entry.birthYear : null,
        runSignupId: entry.sourceRunnerId ?? null,
      });
    }
    assignments.push({ stagedKey, created: isNew });
  }

  const inserted = staged.size ? await db.insert(runnersTable).values([...staged.values()]).returning() : [];
  await updateInBatches([...pendingRunnerUpdates], 8, ([id, updates]) =>
    db.update(runnersTable).set(updates).where(eq(runnersTable.id, id)));
  const insertedByKey = new Map<string, RunnerRow>();
  [...staged.keys()].forEach((key, index) => insertedByKey.set(key, inserted[index]));
  return assignments.map((assignment, index) => {
    const runner = assignment.runner ?? insertedByKey.get(assignment.stagedKey!)!;
    const entry = entries[index];
    cacheRunner(cache, runner, entry.runnerName!, entry.birthYear, entry.sourceRunnerId);
    return { runner, created: assignment.created };
  });
}

export async function recomputeGlobalRanks(): Promise<void> {
  await db.execute(sql`
    WITH ranked AS (
      SELECT id, row_number() OVER (ORDER BY rating DESC, id ASC)::integer AS new_rank
      FROM ${runnersTable}
    )
    UPDATE ${runnersTable}
    SET rank = ranked.new_rank
    FROM ranked
    WHERE ${runnersTable.id} = ranked.id
  `);
}

async function updateInBatches<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(fn));
  }
}

// ─── Rating application constants ───────────────────────────────────────────────

const FLOOR = 500;
const CONFIDENCE_MAX = 0.9;
const CONFIDENCE_DECAY = 3.5; // races

/** How much to trust a single result's implied rating — high for new/inexperienced runners, low for established ones. */
function confidenceWeight(racesDone: number): number {
  return CONFIDENCE_MAX * Math.exp(-racesDone / CONFIDENCE_DECAY);
}

// ─── Core import pipeline ──────────────────────────────────────────────────────

export async function importFromPreview(
  raceId: number,
  preview: ScrapePreview,
  options: { recomputeRanks?: boolean; logRatings?: boolean; runnerCache?: RunnerImportCache; checkPaused?: () => Promise<void> } = {},
): Promise<ImportResult> {
  const [race] = await db.select().from(racesTable).where(eq(racesTable.id, raceId));
  if (!race) throw new Error(`Race ${raceId} not found`);

  const difficultyScore = parseFloat(race.difficultyScore);
  const validEntries = preview.results.filter(e => e.runnerName?.trim());

  const winnerEntry = validEntries.find(r => r.position === 1 && !r.dnf) ?? validEntries.find(r => !r.dnf);
  const winnerTimeSeconds = winnerEntry?.finishTimeSeconds ?? null;

  let runnersCreated = 0;
  let runnersUpdated = 0;
  let duplicateResultsSkipped = 0;
  let runnerCollisionsSeparated = 0;

  // ── Pass 1: resolve all runners, snapshot their PRE-RACE state ───────────────
  const resolvedField: Array<{
    runnerId: number;
    preRaceRating: number;
    racesDone: number;
    pendingSurprise: number | null;
    position: number | null;
    dnf: boolean;
    finishTimeSeconds: number | null;
    sourceResultId: string | null;
    sourceRegistrationId: string | null;
    sourceModifiedAt: Date | null;
    runnerName: string;
    runner: RunnerRow;
  }> = [];
  const resultByRunner = new Map<number, { finishTimeSeconds: number | null; sourceResultId: string | null }>();
  await options.checkPaused?.();
  const batchResolved = await resolveRunnersBatch(validEntries, options.runnerCache);

  for (const [entryIndex, entry] of validEntries.entries()) {
    if (entryIndex % 25 === 0) await options.checkPaused?.();
    const name = entry.runnerName!.trim();
    let { runner, created } = batchResolved[entryIndex];
    const earlier = resultByRunner.get(runner.id);
    if (earlier) {
      const currentTime = entry.finishTimeSeconds ?? null;
      const distinctStableIds = Boolean(entry.sourceRunnerId && runner.runSignupId && entry.sourceRunnerId !== runner.runSignupId);
      const distinctResult = sameRaceResultsIndicateDistinctRunner(
        earlier.finishTimeSeconds, currentTime, runner.runSignupId, entry.sourceRunnerId,
      );
      if (!distinctResult) {
        duplicateResultsSkipped++;
        logger.warn({ raceId, runnerId: runner.id, sourceResultId: entry.sourceResultId }, "Skipping duplicate same-runner result with the same or unavailable finish time");
        continue;
      }
      const originalRunnerId = runner.id;
      runner = await createRunner(
        name, entry.birthYear, entry.gender, entry.country, entry.ageCategory,
        distinctStableIds ? entry.sourceRunnerId : null,
        distinctStableIds ? options.runnerCache : undefined,
      );
      created = true;
      runnerCollisionsSeparated++;
      logger.warn({
        raceId, originalRunnerId, newRunnerId: runner.id,
        previousFinishTimeSeconds: earlier.finishTimeSeconds, finishTimeSeconds: currentTime,
        previousSourceResultId: earlier.sourceResultId, sourceResultId: entry.sourceResultId,
      }, "Created a distinct runner for same-race results with different finish times or stable IDs");
    }
    if (created) runnersCreated++; else runnersUpdated++;
    resultByRunner.set(runner.id, { finishTimeSeconds: entry.finishTimeSeconds ?? null, sourceResultId: entry.sourceResultId ?? null });

    resolvedField.push({
      runnerId: runner.id,
      preRaceRating: runner?.rating ? parseFloat(runner.rating) : 1000,
      racesDone: runner?.totalRaces ?? 0,
      pendingSurprise: runner?.pendingSurprise ? parseFloat(runner.pendingSurprise) : null,
      position: entry.position ?? null,
      dnf: entry.dnf ?? false,
      finishTimeSeconds: entry.finishTimeSeconds ?? null,
      sourceResultId: entry.sourceResultId ?? null,
      sourceRegistrationId: entry.sourceRegistrationId ?? null,
      sourceModifiedAt: entry.sourceModifiedAt ?? null,
      runnerName: runner.name,
      runner,
    });
  }

  // ── Pass 2: compute signals for the whole field at once ──────────────────────
  const eloField: FieldEntry[] = resolvedField.map(r => ({
    runnerId: r.runnerId,
    rating: r.preRaceRating,
    position: r.position,
    dnf: r.dnf,
    finishTimeSeconds: r.finishTimeSeconds,
  }));
  const signals = computeEloChanges(eloField, difficultyScore);

  // ── Pass 3: apply confidence-weighted, confirmation-gated changes ────────────
  const computedResults: Array<{
    runnerId: number; position: number | null; finishTimeSeconds: number | null; dnf: boolean;
    pctChange: number; newRating: number; newPendingSurprise: number | null; enduranceLevel: number;
    sourceResultId: string | null; sourceRegistrationId: string | null; sourceModifiedAt: Date | null;
    runner: RunnerRow;
  }> = [];

  for (const r of resolvedField) {
    const signal = signals.get(r.runnerId);
    const impliedRating = signal?.impliedRating ?? r.preRaceRating;
    const standardDeltaPct = signal?.standardDeltaPct ?? 0;

    const weight = confidenceWeight(r.racesDone);
    const gainSurprise = (impliedRating - r.preRaceRating) / r.preRaceRating;

    let pctChange: number;
    let newPendingSurprise: number | null;

    if (gainSurprise > 0.5) {
      // A dramatic potential gain — only fully trusted once CONFIRMED by a
      // second race pointing the same direction, to avoid one noisy race
      // producing a meaningless swing.
      const confirmed = r.pendingSurprise !== null && r.pendingSurprise > 0.3;
      if (confirmed) {
        const maxGain = 400 * (1 + weight * 3);
        pctChange = Math.min(maxGain, weight * gainSurprise * 100);
        newPendingSurprise = null;
      } else {
        pctChange = weight * 0.15 * gainSurprise * 100;
        newPendingSurprise = gainSurprise;
      }
    } else if (standardDeltaPct >= 0) {
      const maxGain = 40 * (1 + weight * 2);
      pctChange = Math.min(maxGain, standardDeltaPct);
      newPendingSurprise = null;
    } else {
      // Losses always go through the well-behaved standard path, capped conservatively —
      // a single bad race should never crash someone's rating.
      const maxLoss = 12 * (1 + weight);
      pctChange = Math.max(-maxLoss, standardDeltaPct);
      newPendingSurprise = null;
    }

    // Soft floor: approach FLOOR gradually, never land exactly on it —
    // keeps genuinely weak performers spread out rather than clustered.
    const aboveFloor = r.preRaceRating - FLOOR;
    const newAboveFloor = Math.max(0.01, aboveFloor * (1 + pctChange / 100));
    const newRating = FLOOR + newAboveFloor;

    const enduranceLevel = computeEnduranceLevel(winnerTimeSeconds, r.finishTimeSeconds);

    if (options.logRatings !== false) {
      const deltaSign = pctChange >= 0 ? "+" : "";
      console.log(
        `[RATING] ${r.runnerName.padEnd(20)} | Race: ${race.name.padEnd(25)} | Pre: ${r.preRaceRating.toFixed(1).padStart(9)} | Change: ${deltaSign}${pctChange.toFixed(2)}% | Post: ${newRating.toFixed(1).padStart(9)}`
      );
    }

    computedResults.push({
      runnerId: r.runnerId,
      position: r.position,
      finishTimeSeconds: r.finishTimeSeconds,
      dnf: r.dnf,
      pctChange,
      newRating,
      newPendingSurprise,
      enduranceLevel,
      sourceResultId: r.sourceResultId,
      sourceRegistrationId: r.sourceRegistrationId,
      sourceModifiedAt: r.sourceModifiedAt,
      runner: r.runner,
    });
  }
  const totalFinishers = resolvedField.filter(result => !result.dnf).length;

  const runnerIds = computedResults.map(result => result.runnerId);
  if (runnerIds.length) {
    await options.checkPaused?.();
    await db.delete(resultsTable).where(and(eq(resultsTable.raceId, raceId), inArray(resultsTable.runnerId, runnerIds)));
    await db.insert(resultsTable).values(computedResults.map(result => ({
      runnerId: result.runnerId,
      raceId,
      position: result.position,
      finishTimeSeconds: result.finishTimeSeconds,
      dnf: result.dnf,
      points: String(result.pctChange),
      ratingAfter: String(result.newRating),
      source: result.sourceResultId ? "runsignup" : null,
      sourceResultId: result.sourceResultId,
      sourceRegistrationId: result.sourceRegistrationId,
      sourceModifiedAt: result.sourceModifiedAt,
    })));
  }

  const aggregates = runnerIds.length ? await db.select({
    runnerId: resultsTable.runnerId,
    totalRaces: sql<number>`count(*)::integer`,
    bestFinish: sql<number | null>`min(CASE WHEN NOT ${resultsTable.dnf} THEN ${resultsTable.position} END)::integer`,
  }).from(resultsTable).where(inArray(resultsTable.runnerId, runnerIds)).groupBy(resultsTable.runnerId) : [];
  const aggregateByRunner = new Map(aggregates.map(value => [value.runnerId, value]));

  const runnerUpdates = computedResults.map(result => {
    const aggregate = aggregateByRunner.get(result.runnerId);
    const updates = {
      rating: String(result.newRating),
      ratingChange: String(result.pctChange),
      totalRaces: aggregate?.totalRaces ?? 1,
      bestFinish: aggregate?.bestFinish ?? null,
      pendingSurprise: result.newPendingSurprise !== null ? String(result.newPendingSurprise) : null,
      enduranceLevel: result.enduranceLevel > 0 ? String(result.enduranceLevel) : undefined,
    };
    Object.assign(result.runner, updates);
    return { id: result.runnerId, ...updates };
  });
  if (runnerUpdates.length) {
    const rows = runnerUpdates.map(update => sql`(
      ${update.id}::integer, ${update.rating}::numeric, ${update.ratingChange}::numeric,
      ${update.totalRaces}::integer, ${update.bestFinish}::integer,
      ${update.pendingSurprise}::numeric, ${update.enduranceLevel ?? null}::numeric
    )`);
    await db.execute(sql`
      UPDATE ${runnersTable} AS runner SET
        rating = updates.rating,
        rating_change = updates.rating_change,
        total_races = updates.total_races,
        best_finish = updates.best_finish,
        pending_surprise = updates.pending_surprise,
        endurance_level = COALESCE(updates.endurance_level, runner.endurance_level)
      FROM (VALUES ${sql.join(rows, sql`,`)}) AS updates(
        id, rating, rating_change, total_races, best_finish, pending_surprise, endurance_level
      )
      WHERE runner.id = updates.id
    `);
  }
  const resultsCreated = computedResults.length;

  // ── Mark race complete ────────────────────────────────────────────────────────
  await db.update(racesTable).set({
    status: "completed",
    finishersCount: totalFinishers,
  }).where(eq(racesTable.id, raceId));

  // ── Recompute global ranks ────────────────────────────────────────────────────
  if (options.recomputeRanks !== false) await recomputeGlobalRanks();

  logger.info({ raceId, resultsCreated, runnersCreated, runnersUpdated, duplicateResultsSkipped, runnerCollisionsSeparated, difficultyScore }, "Import complete");

  return { resultsCreated, runnersCreated, runnersUpdated, duplicateResultsSkipped, runnerCollisionsSeparated, difficultyScore, source: preview.source, raceName: preview.raceName };
}

// ─── Async wrapper — imports run strictly ONE AT A TIME ───────────────────────

let importQueue: Promise<unknown> = Promise.resolve();

export function startImportJob(raceId: number, preview: ScrapePreview): ImportJob {
  pruneOldJobs();

  const job: ImportJob = {
    id: makeJobId(),
    status: "pending",
    processed: 0,
    total: preview.results.length,
    startedAt: new Date(),
  };
  jobs.set(job.id, job);

  importQueue = importQueue.then(async () => {
    job.status = "running";
    try {
      const result = await importFromPreview(raceId, preview);
      job.status = "done";
      job.processed = preview.results.length;
      job.result = result;
      job.finishedAt = new Date();
      logger.info({ jobId: job.id, raceId, ...result }, "Async import job completed");
    } catch (err: unknown) {
      job.status = "error";
      job.error = err instanceof Error ? err.message : "Unknown error";
      job.finishedAt = new Date();
      logger.error({ jobId: job.id, raceId, err: job.error }, "Async import job failed");
    }
  });

  return job;
}
