/**
 * Import pipeline — Elo-based rating system.
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
  // 1. Match by name + birth year
  if (birthYear) {
    const [row] = await db
      .select()
      .from(runnersTable)
      .where(and(ilike(runnersTable.name, name), eq(runnersTable.birthYear, birthYear)));
    if (row) {
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

  // 3. Create new runner — starting rating strictly 200
  const currentYear = new Date().getFullYear();
  const age = birthYear ? currentYear - birthYear : null;
  const [newRunner] = await db.insert(runnersTable).values({
    name,
    country: country ?? "Unknown",
    gender: gender ?? "M",
    rating: "200",
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

  const winnerEntry = validEntries.find(r => r.position === 1 && !r.dnf) ?? validEntries.find(r => !r.dnf);
  const winnerTimeSeconds = winnerEntry?.finishTimeSeconds ?? null;

  let runnersCreated = 0;
  let runnersUpdated = 0;

  // ── Pass 1: resolve all runners, snapshot their PRE-RACE ratings ─────────────
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
    
    // Ensure rating defaults to 200 if undefined/null
    const parsedRating = runner?.rating ? parseFloat(runner.rating) : 200;

    resolvedField.push({
      runnerId,
      preRaceRating: parsedRating,
      position: entry.position ?? null,
      dnf: entry.dnf ?? false,
      finishTimeSeconds: entry.finishTimeSeconds ?? null,
    });
  }

  // ── Pass 2: compute all pairwise deltas using PRE-RACE ratings ───────────────
  const eloField: FieldEntry[] = resolvedField.map(r => ({
    runnerId: r.runnerId,
    rating: r.preRaceRating,
    position: r.position,
    dnf: r.dnf,
    finishTimeSeconds: r.finishTimeSeconds,
  }));
  const eloDeltas = computeEloChanges(eloField, difficultyScore);

  // ── Pass 3: apply deltas + persist results ───────────────────────────────────
  let resultsCreated = 0;

  for (const r of resolvedField) {
    const delta = eloDeltas.get(r.runnerId) ?? 0;

    const enduranceLevel = computeEnduranceLevel(winnerTimeSeconds, r.finishTimeSeconds);
    const elFactor = 0.9 + 0.2 * Math.min(enduranceLevel / 1000, 1);
    const adjustedDelta = delta * elFactor;

    const newRating = Math.max(0, r.preRaceRating * (1 + adjustedDelta / 100));

    const [runner] = await db.select().from(runnersTable).where(eq(runnersTable.id, r.runnerId));

    // Terminal Logging
    const deltaSign = adjustedDelta >= 0 ? "+" : "";
    console.log(
      `[ELO] ${runner.name.padEnd(20)} | Race: ${race.name.padEnd(25)} | Pre: ${r.preRaceRating.toFixed(1).padStart(6)} | Change: ${deltaSign}${adjustedDelta.toFixed(2)}% | Post: ${newRating.toFixed(1).padStart(6)}`
    );

    await db.delete(resultsTable)
      .where(and(eq(resultsTable.runnerId, r.runnerId), eq(resultsTable.raceId, raceId)));

    await db.insert(resultsTable).values({
      runnerId: r.runnerId,
      raceId,
      position: r.position,
      finishTimeSeconds: r.finishTimeSeconds,
      dnf: r.dnf,
      points: String(adjustedDelta),
      ratingAfter: String(newRating),
    });

    resultsCreated++;

    const allResults = await db.select().from(resultsTable).where(eq(resultsTable.runnerId, r.runnerId));
    const finishes = allResults.filter(x => !x.dnf && x.position);
    const bestFinish = finishes.length ? Math.min(...finishes.map(x => x.position!)) : null;
    const totalRaces = allResults.length;

    await db.update(runnersTable).set({
      rating: String(newRating),
      ratingChange: String(adjustedDelta),
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

  // ── Recompute global ranks ────────────────────────────────────────────────────
  const allRunners = await db.select().from(runnersTable).orderBy(desc(runnersTable.rating));
  for (let i = 0; i < allRunners.length; i++) {
    await db.update(runnersTable).set({ rank: i + 1 }).where(eq(runnersTable.id, allRunners[i].id));
  }

  logger.info({ raceId, resultsCreated, runnersCreated, runnersUpdated, difficultyScore }, "Import complete");

  return { resultsCreated, runnersCreated, runnersUpdated, difficultyScore, source: preview.source, raceName: preview.raceName };
}

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