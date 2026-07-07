/**
 * Import pipeline — Elo-based rating system.
 *
 * How it works:
 *  1. Resolve every runner in the scraped field (create or find by name+birthYear).
 *  2. Snapshot everyone's rating BEFORE any updates.
 *  3. Compute pairwise Elo deltas for the whole field in one pass.
 *  4. Apply all deltas atomically (no runner's new rating affects another's calc).
 *  5. Persist per-race Elo delta into results.points (can be negative).
 *  6. Update aggregate stats (totalRaces, bestFinish, enduranceLevel).
 *  7. Mark race complete and recompute global ranks.
 *
 * Async job registry lets callers fire-and-forget then poll for status.
 */
import { db, racesTable, resultsTable, runnersTable } from "@workspace/db";
import { eq, desc, ilike, and } from "drizzle-orm";
import type { ScrapePreview } from "./scrapers/types";
import { computeEloChanges, computeEnduranceLevel, type FieldEntry } from "./difficulty";
import { logger } from "./logger";

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

async function resolveRunner(
  name: string,
  birthYear: number | null | undefined,
  gender: string | null | undefined,
  country: string | null | undefined,
  ageCategory: string | null | undefined,
): Promise<{ runnerId: number; created: boolean }> {
  // 1. Match by name + birth year (most specific)
  if (birthYear) {
    const [row] = await db
      .select()
      .from(runnersTable)
      .where(and(ilike(runnersTable.name, name), eq(runnersTable.birthYear, birthYear)));
    if (row) {
      // Fill in any missing profile fields
      const updates: Record<string, unknown> = {};
      if (!row.gender && gender) updates.gender = gender;
      if (!row.country && country) updates.country = country;
      if (!row.ageCategory && ageCategory) updates.ageCategory = ageCategory;
      if (Object.keys(updates).length) {
        await db.update(runnersTable).set(updates).where(eq(runnersTable.id, row.id));
      }
      return { runnerId: row.id, created: false };
    }
  }

  // 2. Fallback: name only
  const [row] = await db.select().from(runnersTable).where(ilike(runnersTable.name, name));
  if (row) {
    const updates: Record<string, unknown> = {};
    if (!row.gender && gender) updates.gender = gender;
    if (!row.country && country) updates.country = country;
    if (!row.birthYear && birthYear) updates.birthYear = birthYear;
    if (!row.ageCategory && ageCategory) updates.ageCategory = ageCategory;
    if (Object.keys(updates).length) {
      await db.update(runnersTable).set(updates).where(eq(runnersTable.id, row.id));
    }
    return { runnerId: row.id, created: false };
  }

  // 3. Create new runner — starting Elo 1500
  const currentYear = new Date().getFullYear();
  const age = birthYear ? currentYear - birthYear : null;
  const [newRunner] = await db.insert(runnersTable).values({
    name,
    country: country ?? "Unknown",
    gender: gender ?? "M",
    rating: "1500",
    ratingChange: "0",
    rank: 0,
    totalRaces: 0,
    totalDistanceKm: "0",
    birthYear: birthYear ?? null,
    ageCategory: ageCategory ?? null,
    age: age ?? null,
  }).returning();

  return { runnerId: newRunner.id, created: true };
}

// ─── Core import pipeline ──────────────────────────────────────────────────────

export async function importFromPreview(
  raceId: number,
  preview: ScrapePreview,
): Promise<ImportResult> {
  const [race] = await db.select().from(racesTable).where(eq(racesTable.id, raceId));
  if (!race) throw new Error(`Race ${raceId} not found`);

  const difficultyScore = parseFloat(race.difficultyScore);
  const validEntries = preview.results.filter(e => e.runnerName?.trim());
  const totalFinishers = validEntries.filter(r => !r.dnf).length;

  // Winner's finish time for endurance-level calc
  const winnerEntry = validEntries.find(r => r.position === 1 && !r.dnf) ?? validEntries.find(r => !r.dnf);
  const winnerTimeSeconds = winnerEntry?.finishTimeSeconds ?? null;

  let runnersCreated = 0;
  let runnersUpdated = 0;

  // ── Pass 1: resolve all runners, snapshot their PRE-RACE ratings ─────────────
  // We must collect all ratings BEFORE updating any, so pairwise Elo is fair.
  const resolvedField: Array<{
    runnerId: number;
    preRaceRating: number;
    position: number | null;
    dnf: boolean;
    finishTimeSeconds: number | null;
  }> = [];

  for (const entry of validEntries) {
    const name = entry.runnerName!.trim();
    const { runnerId, created } = await resolveRunner(
      name,
      entry.birthYear,
      entry.gender,
      entry.country,
      entry.ageCategory,
    );
    if (created) runnersCreated++; else runnersUpdated++;

    const [runner] = await db.select().from(runnersTable).where(eq(runnersTable.id, runnerId));
    resolvedField.push({
      runnerId,
      preRaceRating: parseFloat(runner.rating),
      position: entry.position ?? null,
      dnf: entry.dnf ?? false,
      finishTimeSeconds: entry.finishTimeSeconds ?? null,
    });
  }

  // ── Pass 2: compute all pairwise Elo deltas using PRE-RACE ratings ───────────
  const eloField: FieldEntry[] = resolvedField.map(r => ({
    runnerId: r.runnerId,
    rating: r.preRaceRating,
    position: r.position,
    dnf: r.dnf,
  }));
  const eloDeltas = computeEloChanges(eloField, difficultyScore);

  // ── Pass 3: apply Elo deltas + persist results ───────────────────────────────
  let resultsCreated = 0;

  for (const r of resolvedField) {
    const delta = eloDeltas.get(r.runnerId) ?? 0;
    const newRating = Math.max(100, r.preRaceRating + delta); // Floor at 100

    // Idempotent result upsert
    await db.delete(resultsTable)
      .where(and(eq(resultsTable.runnerId, r.runnerId), eq(resultsTable.raceId, raceId)));

    // Store Elo delta in points (can be negative — reflects real performance)
    await db.insert(resultsTable).values({
      runnerId: r.runnerId,
      raceId,
      position: r.position,
      finishTimeSeconds: r.finishTimeSeconds,
      dnf: r.dnf,
      points: String(delta),          // Elo delta for this race
    });

    resultsCreated++;

    // Aggregate stats
    const allResults = await db.select().from(resultsTable).where(eq(resultsTable.runnerId, r.runnerId));
    const finishes = allResults.filter(x => !x.dnf && x.position);
    const bestFinish = finishes.length ? Math.min(...finishes.map(x => x.position!)) : null;
    const totalRaces = allResults.length;

    const enduranceLevel = computeEnduranceLevel(winnerTimeSeconds, r.finishTimeSeconds);

    await db.update(runnersTable).set({
      rating: String(newRating),
      ratingChange: String(delta),
      totalRaces,
      bestFinish,
      enduranceLevel: enduranceLevel > 0 ? String(enduranceLevel) : undefined,
    }).where(eq(runnersTable.id, r.runnerId));
  }

  // ── Mark race complete ────────────────────────────────────────────────────────
  await db.update(racesTable).set({
    status: "completed",
    finishersCount: totalFinishers,
  }).where(eq(racesTable.id, raceId));

  // ── Recompute global ranks by Elo rating ──────────────────────────────────────
  const allRunners = await db.select().from(runnersTable).orderBy(desc(runnersTable.rating));
  for (let i = 0; i < allRunners.length; i++) {
    await db.update(runnersTable).set({ rank: i + 1 }).where(eq(runnersTable.id, allRunners[i].id));
  }

  logger.info({ raceId, resultsCreated, runnersCreated, runnersUpdated, difficultyScore }, "Import complete");

  return { resultsCreated, runnersCreated, runnersUpdated, difficultyScore, source: preview.source, raceName: preview.raceName };
}

// ─── Async wrapper ────────────────────────────────────────────────────────────

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

  (async () => {
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
  })();

  return job;
}
