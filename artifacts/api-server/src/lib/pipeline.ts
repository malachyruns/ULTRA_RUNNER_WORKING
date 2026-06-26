/**
 * Shared import pipeline.
 *
 * Receives a scraped preview and a race row, then:
 *  1. Resolves each runner (create or update) matching on name + birth year.
 *  2. Computes points using two complementary algorithms:
 *     a) Difficulty-weighted position score  (used for global rankings).
 *     b) Winner-time endurance level: (winnerTime / runnerTime) × 1000.
 *  3. Upserts the race_results row (idempotent).
 *  4. Updates each runner's aggregate stats and endurance level.
 *  5. Recomputes global rank for all runners.
 *
 * Async job registry lets callers fire-and-forget then poll for status.
 */
import { db, racesTable, resultsTable, runnersTable } from "@workspace/db";
import { eq, desc, ilike, and, or } from "drizzle-orm";
import type { ScrapePreview } from "./scrapers/types";
import { computePoints } from "./difficulty";
import { logger } from "./logger";

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Endurance level formula from the spec:
 *   WinnerTime / RunnerTime × 1000
 *
 * Winner scores 1 000. A runner who takes twice as long scores 500.
 * Returns 0 if either time is missing.
 */
export function computeEnduranceLevel(
  winnerTimeSeconds: number | null | undefined,
  runnerTimeSeconds: number | null | undefined,
): number {
  if (!winnerTimeSeconds || !runnerTimeSeconds || runnerTimeSeconds <= 0) return 0;
  return Math.round((winnerTimeSeconds / runnerTimeSeconds) * 1000 * 10) / 10;
}

// ─── Async job registry ────────────────────────────────────────────────────────

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
}

const jobs = new Map<string, ImportJob>();

function makeJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getJob(id: string): ImportJob | undefined {
  return jobs.get(id);
}

// Prune jobs older than 30 minutes to avoid memory leaks
function pruneOldJobs(): void {
  const cutoff = Date.now() - 30 * 60_000;
  for (const [id, job] of jobs) {
    if (job.startedAt.getTime() < cutoff) jobs.delete(id);
  }
}

// ─── Core pipeline ────────────────────────────────────────────────────────────

export async function importFromPreview(
  raceId: number,
  preview: ScrapePreview,
): Promise<ImportResult> {
  const [race] = await db.select().from(racesTable).where(eq(racesTable.id, raceId));
  if (!race) throw new Error(`Race ${raceId} not found`);

  const difficultyScore = parseFloat(race.difficultyScore);
  const finisherResults = preview.results.filter(r => !r.dnf);
  const totalFinishers = finisherResults.length;

  // Winner's finish time (position 1, or first non-DNF entry)
  const winnerEntry = finisherResults.find(r => r.position === 1) ?? finisherResults[0];
  const winnerTimeSeconds = winnerEntry?.finishTimeSeconds ?? null;

  let runnersCreated = 0;
  let runnersUpdated = 0;
  let resultsCreated = 0;

  for (const entry of preview.results) {
    const name = entry.runnerName?.trim();
    if (!name) continue;

    // ── 1. Resolve runner (name + birth year dedup) ──────────────────────────
    let existingRunner = null;

    // Best match: name AND birth year both match
    if (entry.birthYear) {
      const [byBoth] = await db
        .select()
        .from(runnersTable)
        .where(and(ilike(runnersTable.name, name), eq(runnersTable.birthYear, entry.birthYear)));
      existingRunner = byBoth ?? null;
    }

    // Fallback: name-only match (if no birth year available)
    if (!existingRunner) {
      const [byName] = await db
        .select()
        .from(runnersTable)
        .where(ilike(runnersTable.name, name));
      existingRunner = byName ?? null;
    }

    let runnerId: number;

    if (existingRunner) {
      runnerId = existingRunner.id;
      // Update profile fields that may be newly available
      const updates: Record<string, unknown> = {};
      if (!existingRunner.gender && entry.gender) updates.gender = entry.gender;
      if (!existingRunner.country && entry.country) updates.country = entry.country;
      if (!existingRunner.birthYear && entry.birthYear) updates.birthYear = entry.birthYear;
      if (!existingRunner.ageCategory && entry.ageCategory) updates.ageCategory = entry.ageCategory;
      if (Object.keys(updates).length) {
        await db.update(runnersTable).set(updates).where(eq(runnersTable.id, runnerId));
      }
      runnersUpdated++;
    } else {
      const currentYear = new Date().getFullYear();
      const age = entry.birthYear ? currentYear - entry.birthYear : null;
      const [newRunner] = await db.insert(runnersTable).values({
        name,
        country: entry.country ?? "Unknown",
        gender: entry.gender ?? "M",
        rating: "1000",
        rank: 0,
        totalRaces: 0,
        totalDistanceKm: "0",
        birthYear: entry.birthYear ?? null,
        ageCategory: entry.ageCategory ?? null,
        age: age ?? null,
      }).returning();
      runnerId = newRunner.id;
      runnersCreated++;
    }

    // ── 2. Idempotent result upsert ───────────────────────────────────────────
    await db.delete(resultsTable)
      .where(and(eq(resultsTable.runnerId, runnerId), eq(resultsTable.raceId, raceId)));

    // Difficulty-weighted position points (used for global ranking)
    const points = computePoints({
      position: entry.position,
      dnf: entry.dnf ?? false,
      totalFinishers,
      difficultyScore,
    });

    await db.insert(resultsTable).values({
      runnerId,
      raceId,
      position: entry.position ?? null,
      finishTimeSeconds: entry.finishTimeSeconds ?? null,
      dnf: entry.dnf ?? false,
      points: String(points),
    });

    resultsCreated++;

    // ── 3. Runner aggregate stats ─────────────────────────────────────────────
    const allResults = await db.select().from(resultsTable).where(eq(resultsTable.runnerId, runnerId));
    const finishes = allResults.filter(r => !r.dnf && r.position);
    const bestFinish = finishes.length ? Math.min(...finishes.map(r => r.position!)) : null;
    const totalRaces = allResults.length;
    const totalPoints = allResults.reduce((acc, r) => acc + parseFloat(r.points), 0);

    // Winner-time endurance level: best (highest) across all this runner's results
    const enduranceLevel = computeEnduranceLevel(winnerTimeSeconds, entry.finishTimeSeconds);

    await db.update(runnersTable).set({
      totalRaces,
      bestFinish,
      rating: String(1000 + totalPoints),
      enduranceLevel: String(enduranceLevel > 0 ? enduranceLevel : 0),
    }).where(eq(runnersTable.id, runnerId));
  }

  // ── 4. Mark race complete ─────────────────────────────────────────────────
  await db.update(racesTable).set({
    status: "completed",
    finishersCount: totalFinishers,
  }).where(eq(racesTable.id, raceId));

  // ── 5. Recompute global ranks ─────────────────────────────────────────────
  const allRunners = await db.select().from(runnersTable).orderBy(desc(runnersTable.rating));
  for (let i = 0; i < allRunners.length; i++) {
    await db.update(runnersTable).set({ rank: i + 1 }).where(eq(runnersTable.id, allRunners[i].id));
  }

  return {
    resultsCreated,
    runnersCreated,
    runnersUpdated,
    difficultyScore,
    source: preview.source,
    raceName: preview.raceName,
  };
}

// ─── Async wrapper ────────────────────────────────────────────────────────────

/**
 * Start an import in the background and return a job ID immediately.
 * The caller can poll GET /portal/jobs/:jobId for progress.
 */
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

  // Fire and forget
  (async () => {
    job.status = "running";
    try {
      const result = await importFromPreview(raceId, preview);
      job.status = "done";
      job.processed = preview.results.length;
      job.result = result;
      job.finishedAt = new Date();
      logger.info({ jobId: job.id, raceId, ...result }, "Import job completed");
    } catch (err: unknown) {
      job.status = "error";
      job.error = err instanceof Error ? err.message : "Unknown error";
      job.finishedAt = new Date();
      logger.error({ jobId: job.id, raceId, err: job.error }, "Import job failed");
    }
  })();

  return job;
}
