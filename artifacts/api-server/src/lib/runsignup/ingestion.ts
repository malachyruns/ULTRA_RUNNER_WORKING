import { db, racesTable, resultsTable, syncJobsTable } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { computeDifficultyScore } from "../difficulty";
import { evaluateRankingEligibility } from "../eligibility";
import { importFromPreview, recomputeGlobalRanks, type RunnerImportCache } from "../pipeline";
import type { ScrapedResult } from "../scrapers/types";
import { parseTimeToSeconds } from "../scrapers/types";
import { logger } from "../logger";
import { RunSignupClient } from "./client";

export interface SyncSummary {
  racesEventsProcessed: number; resultsFound: number; newRunners: number; matchedRunners: number;
  resultsAdded: number; resultsUpdated: number; duplicatesSkipped: number; rejectedRecords: number;
}
const emptySummary = (): SyncSummary => ({ racesEventsProcessed: 0, resultsFound: 0, newRunners: 0, matchedRunners: 0, resultsAdded: 0, resultsUpdated: 0, duplicatesSkipped: 0, rejectedRecords: 0 });

type AnyRecord = Record<string, unknown>;
const rec = (v: unknown): AnyRecord => v && typeof v === "object" ? v as AnyRecord : {};
const str = (v: unknown): string | null => v == null || v === "" ? null : String(v);
const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };
function isoDate(value: unknown): string {
  const raw = str(value);
  if (!raw) return new Date().toISOString().slice(0, 10);
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  return raw.slice(0, 10);
}
const arrayAt = (obj: unknown, key: string): unknown[] => {
  const direct = rec(obj)[key];
  if (Array.isArray(direct)) return direct;
  for (const value of Object.values(rec(obj))) { const found = arrayAt(value, key); if (found.length) return found; }
  return [];
};

export function selectPublicResults(payload: unknown): unknown[] {
  const sets = arrayAt(payload, "individual_results_sets").map(rec).filter(set => set.public_results !== "F");
  if (!sets.length) return arrayAt(payload, "results");
  const preferred = sets.find(set => /overall/i.test(str(set.individual_result_set_name) ?? "")) ?? sets[0];
  return Array.isArray(preferred.results) ? preferred.results : [];
}

export function parseRunSignupIdentifier(value: string): { raceId: string; eventId?: string } {
  const trimmed = value.trim();
  if (/^\d+(?::\d+)?$/.test(trimmed)) { const [raceId, eventId] = trimmed.split(":"); return { raceId, eventId }; }
  const url = new URL(trimmed);
  const raceId = url.searchParams.get("raceId") ?? url.searchParams.get("race_id") ?? url.pathname.match(/Race\/(\d+)/i)?.[1];
  const eventId = url.searchParams.get("eventId") ?? url.searchParams.get("event_id") ?? undefined;
  if (!raceId) throw new Error("Could not find a RunSignup race ID in the URL");
  return { raceId, eventId };
}

function unwrap(items: unknown[], singular: string): AnyRecord[] {
  return items.map(item => rec(rec(item)[singular] ?? item));
}

function eventDistance(event: AnyRecord) {
  return evaluateRankingEligibility({
    distance: str(event.distance ?? event.event_distance ?? event.distance_value),
    distanceUnits: str(event.distance_units ?? event.distance_unit ?? event.units),
    eventType: str(event.event_type ?? event.type), name: str(event.name ?? event.event_name),
    requireRunningEventType: true,
  });
}

export function mapRunSignupResult(rawValue: unknown): ScrapedResult | null {
  const raw = rec(rawValue);
  const first = str(raw.first_name) ?? "";
  const last = str(raw.last_name) ?? "";
  const name = str(raw.name ?? raw.full_name) ?? `${first} ${last}`.trim();
  if (!name || /^(anonymous|unknown|redacted|private)(\s+(anonymous|participant|runner|unknown))?$/i.test(name.trim())) return null;
  const clock = str(raw.clock_time ?? raw.chip_time ?? raw.finish_time ?? raw.time);
  const status = (str(raw.status) ?? clock ?? "").toUpperCase();
  const dnf = /DNF|DNS|DQ|DSQ/.test(status);
  const age = num(raw.age);
  const modified = num(raw.modified_ts ?? raw.last_modified_ts ?? raw.modified_timestamp);
  const parsedFinishTime = dnf ? null : parseTimeToSeconds(clock ?? "");
  return {
    runnerName: name, country: str(raw.country_code ?? raw.country ?? raw.state),
    gender: str(raw.gender), position: dnf ? null : num(raw.place ?? raw.overall_place),
    finishTimeSeconds: parsedFinishTime == null ? null : Math.round(parsedFinishTime), dnf,
    birthYear: age && age > 0 && age < 120 ? new Date().getFullYear() - age : null,
    ageCategory: str(raw.age_group ?? raw.division),
    sourceRunnerId: str(raw.user_id ?? raw.profile_id), sourceResultId: str(raw.result_id),
    sourceRegistrationId: str(raw.registration_id), sourceModifiedAt: modified ? new Date(modified * 1000) : null,
  };
}

export function deduplicateSourceResults(entries: ScrapedResult[]): ScrapedResult[] {
  const seen = new Set<string>();
  return entries.filter(entry => {
    const key = entry.sourceResultId ?? `${entry.sourceRegistrationId ?? ""}:${entry.runnerName}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export const hasNextPage = (received: number, pageSize: number) => received === pageSize;

async function saveJob(id: number, values: Partial<typeof syncJobsTable.$inferInsert>) {
  await db.update(syncJobsTable).set({ ...values, updatedAt: new Date() }).where(eq(syncJobsTable.id, id));
}

async function checkPaused(jobId: number, summary: SyncSummary) {
  const [state] = await db.select({ pauseRequestedAt: syncJobsTable.pauseRequestedAt }).from(syncJobsTable).where(eq(syncJobsTable.id, jobId));
  if (state?.pauseRequestedAt) {
    await saveJob(jobId, { status: "paused", summary });
    throw new Error("__PAUSED__");
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      output[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

async function processEvent(client: RunSignupClient, jobId: number, race: AnyRecord, event: AnyRecord, summary: SyncSummary, checkpoint?: number, runnerCache?: RunnerImportCache) {
  await checkPaused(jobId, summary);
  const raceId = str(race.race_id ?? race.id)!;
  const eventId = str(event.event_id ?? event.id)!;
  const eligibility = eventDistance(event);
  if (!eligibility.eligible || !eventId) { summary.rejectedRecords++; return; }
  await saveJob(jobId, { currentRaceId: raceId, currentEventId: eventId, resultPage: 1, summary });
  const entries: ScrapedResult[] = [];
  const eventDate = isoDate(event.start_time ?? event.event_date ?? race.next_date ?? race.start_time);
  const eventYear = Number(eventDate.slice(0, 4));
  let page = 1;
  for (;;) {
    await checkPaused(jobId, summary);
    const payload = await client.getResults(raceId, eventId, page, checkpoint);
    const rawResults = selectPublicResults(payload);
    for (const raw of rawResults) {
      const mapped = mapRunSignupResult(raw);
      if (mapped) {
        const age = num(rec(raw).age);
        if (age && eventYear) mapped.birthYear = eventYear - age;
        entries.push(mapped);
      } else summary.rejectedRecords++;
    }
    summary.resultsFound += rawResults.length;
    await saveJob(jobId, { resultPage: page + 1, summary });
    await checkPaused(jobId, summary);
    if (!hasNextPage(rawResults.length, 1000)) break;
    page++;
  }
  const uniqueEntries = deduplicateSourceResults(entries);
  summary.duplicatesSkipped += entries.length - uniqueEntries.length;
  if (!uniqueEntries.length) { summary.racesEventsProcessed++; return; }

  const baseSourceUrl = str(race.url) ?? `https://runsignup.com/Race/${raceId}`;
  const sourceUrl = `${baseSourceUrl}${baseSourceUrl.includes("?") ? "&" : "?"}eventId=${eventId}`;
  const [existingRace] = await db.select().from(racesTable).where(and(eq(racesTable.source, "runsignup"), eq(racesTable.sourceRaceId, raceId), eq(racesTable.sourceEventId, eventId)));
  const surface = /trail/i.test(str(event.event_type) ?? "") ? "trail" : "road";
  const values = {
    name: (() => {
      const raceName = str(race.name ?? race.race_name);
      const eventName = str(event.name ?? event.event_name);
      if (raceName && eventName && raceName.toLowerCase() !== eventName.toLowerCase()) return `${raceName} — ${eventName}`;
      return eventName ?? raceName ?? "RunSignup Ultra";
    })(),
    location: [str(rec(race.address).city ?? race.city), str(rec(race.address).state ?? race.state)].filter(Boolean).join(", ") || "Unknown",
    country: str(rec(race.address).country_code ?? race.country_code ?? race.country) ?? "Unknown",
    date: eventDate,
    distanceKm: String(eligibility.normalizedDistanceKm!), category: eligibility.category!, surface,
    distanceLabel: str(event.distance) ?? `${eligibility.normalizedDistanceKm} km`,
    difficultyScore: String(computeDifficultyScore({ surface, distanceKm: eligibility.normalizedDistanceKm! })),
    status: "completed", source: "runsignup", sourceRaceId: raceId, sourceEventId: eventId, sourceUrl,
  };
  let localRace = existingRace;
  if (localRace) [localRace] = await db.update(racesTable).set(values).where(eq(racesTable.id, localRace.id)).returning();
  else [localRace] = await db.insert(racesTable).values(values).returning();

  const ids = uniqueEntries.map(e => e.sourceResultId).filter(Boolean) as string[];
  const existingIds = ids.length ? await db.select({ id: resultsTable.id, sourceResultId: resultsTable.sourceResultId }).from(resultsTable).where(and(eq(resultsTable.source, "runsignup"), inArray(resultsTable.sourceResultId, ids))) : [];
  if (existingIds.length === uniqueEntries.length) {
    if (checkpoint) {
      const bySourceId = new Map(existingIds.map(row => [row.sourceResultId, row.id]));
      await mapWithConcurrency(uniqueEntries, 8, async entry => {
        const id = entry.sourceResultId ? bySourceId.get(entry.sourceResultId) : undefined;
        if (!id) return;
        await db.update(resultsTable).set({ position: entry.position, finishTimeSeconds: entry.finishTimeSeconds, dnf: entry.dnf ?? false, sourceRegistrationId: entry.sourceRegistrationId, sourceModifiedAt: entry.sourceModifiedAt }).where(eq(resultsTable.id, id));
      });
      summary.resultsUpdated += uniqueEntries.length;
    } else summary.duplicatesSkipped += uniqueEntries.length;
    summary.racesEventsProcessed++; return;
  }
  const imported = await importFromPreview(localRace.id, { raceName: values.name, raceDate: values.date, raceLocation: values.location, raceCountry: values.country, raceDistanceKm: eligibility.normalizedDistanceKm, raceSurface: surface, source: "RunSignup", url: sourceUrl, totalFound: uniqueEntries.length, results: uniqueEntries }, { recomputeRanks: false, logRatings: false, runnerCache, checkPaused: () => checkPaused(jobId, summary) });
  summary.newRunners += imported.runnersCreated; summary.matchedRunners += imported.runnersUpdated;
  summary.duplicatesSkipped += imported.duplicateResultsSkipped;
  summary.resultsAdded += uniqueEntries.length - existingIds.length; summary.resultsUpdated += existingIds.length;
  summary.racesEventsProcessed++;
}

async function execute(jobId: number) {
  const client = new RunSignupClient();
  const configuredConcurrency = Number(process.env.RUNSIGNUP_MAX_CONCURRENCY ?? 2);
  const apiConcurrency = Math.min(2, Math.max(1, Number.isFinite(configuredConcurrency) ? Math.floor(configuredConcurrency) : 2));
  const raceCache = new Map<string, Promise<AnyRecord>>();
  const runnerCache: RunnerImportCache = new Map();
  const getRacePayload = (raceId: string) => {
    let pending = raceCache.get(raceId);
    if (!pending) {
      pending = client.getRace(raceId);
      raceCache.set(raceId, pending);
    }
    return pending;
  };
  const [job] = await db.select().from(syncJobsTable).where(eq(syncJobsTable.id, jobId));
  const summary = { ...emptySummary(), ...(job.summary as Partial<SyncSummary>) };
  await saveJob(jobId, { status: "running", startedAt: job.startedAt ?? new Date(), error: null });
  try {
    if (job.requestedIdentifier) {
      const requested = parseRunSignupIdentifier(job.requestedIdentifier);
      const racePayload = await getRacePayload(requested.raceId);
      const race = rec(rec(racePayload).race ?? arrayAt(racePayload, "races")[0] ?? racePayload);
      const events = unwrap(arrayAt(racePayload, "events"), "event").filter(e => !requested.eventId || str(e.event_id ?? e.id) === requested.eventId);
      for (const event of events) await processEvent(client, jobId, race, event, summary, job.checkpointTimestamp ?? undefined, runnerCache);
    } else {
      let page = job.discoveryPage;
      for (;;) {
        const payload = await client.getUpdatedPublicResultSets(page, job.checkpointTimestamp ?? undefined);
        const resultSets = arrayAt(payload, "result_sets").map(rec);
        const eventKeys = new Map<string, { raceId: string; eventId: string }>();
        for (const set of resultSets) {
          const raceId = str(set.race_id), eventId = str(set.event_id);
          if (raceId && eventId) eventKeys.set(`${raceId}:${eventId}`, { raceId, eventId });
        }
        const uniqueRaceIds = [...new Set([...eventKeys.values()].map(value => value.raceId))];
        await mapWithConcurrency(uniqueRaceIds, apiConcurrency, getRacePayload);
        for (const { raceId, eventId } of eventKeys.values()) {
          const racePayload = await getRacePayload(raceId);
          const race = rec(rec(racePayload).race ?? arrayAt(racePayload, "races")[0] ?? racePayload);
          const event = unwrap(arrayAt(racePayload, "events"), "event").find(candidate => str(candidate.event_id ?? candidate.id) === eventId);
          if (event) await processEvent(client, jobId, race, event, summary, job.checkpointTimestamp ?? undefined, runnerCache);
          else summary.rejectedRecords++;
        }
        await saveJob(jobId, { discoveryPage: page + 1, summary });
        if (resultSets.length < 1000) break;
        page++;
      }
    }
    await recomputeGlobalRanks();
    await saveJob(jobId, { status: "done", finishedAt: new Date(), checkpointTimestamp: Math.floor(Date.now() / 1000) - 10, summary });
  } catch (error) {
    if (error instanceof Error && error.message === "__PAUSED__") return;
    const message = error instanceof Error ? error.message : "Unknown RunSignup sync error";
    await saveJob(jobId, { status: "error", error: message, finishedAt: new Date(), summary });
    logger.error({ jobId, error: message }, "RunSignup sync failed");
  }
}

let queue: Promise<void> = Promise.resolve();
function enqueue(jobId: number) { queue = queue.then(() => execute(jobId)); }

export async function recoverPendingRunSignupSyncs() {
  const pending = await db.select({ id: syncJobsTable.id }).from(syncJobsTable)
    .where(and(eq(syncJobsTable.source, "runsignup"), eq(syncJobsTable.status, "pending")));
  for (const job of pending) enqueue(job.id);
  return pending.length;
}

export async function startRunSignupSync(mode: "historical" | "incremental" | "single", identifier?: string, organizerId?: number) {
  let checkpoint: number | undefined;
  if (mode === "incremental") {
    const [last] = await db.select().from(syncJobsTable).where(and(eq(syncJobsTable.source, "runsignup"), eq(syncJobsTable.status, "done"))).orderBy(sql`${syncJobsTable.finishedAt} DESC`).limit(1);
    checkpoint = last?.checkpointTimestamp ?? undefined;
  }
  const [job] = await db.insert(syncJobsTable).values({ source: "runsignup", organizerId, mode, requestedIdentifier: identifier, checkpointTimestamp: checkpoint, summary: emptySummary() }).returning();
  enqueue(job.id); return job;
}

export async function resumeRunSignupSync(id: number) { await saveJob(id, { status: "pending", pauseRequestedAt: null, error: null }); enqueue(id); }
export async function pauseRunSignupSync(id: number) { await saveJob(id, { status: "paused", pauseRequestedAt: new Date() }); }
