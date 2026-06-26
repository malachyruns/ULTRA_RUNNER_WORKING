import { Router } from "express";
import { db, racesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { requireOrganizer } from "../middleware/requireOrganizer";
import { scrapeUrl } from "../lib/scrapers";
import { searchForRaceResults } from "../lib/scrapers/search";
import { importFromPreview, startImportJob, getJob } from "../lib/pipeline";
import { logger } from "../lib/logger";

const router = Router();

const ScrapeUrlInput = z.object({ url: z.string().url() });

// ─── Preview (no DB writes) ─────────────────────────────────────────────────

router.post("/portal/scrape", requireOrganizer, async (req, res) => {
  const { url } = ScrapeUrlInput.parse(req.body);
  try {
    const preview = await scrapeUrl(url);
    res.json(preview);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Scrape failed";
    logger.warn({ url, err: message }, "Scrape preview failed");
    res.status(422).json({ error: message });
  }
});

// ─── Synchronous import ─────────────────────────────────────────────────────

router.post("/portal/races/:id/scrape-import", requireOrganizer, async (req, res) => {
  const raceId = parseInt(req.params["id"] as string, 10);
  const { url } = ScrapeUrlInput.parse(req.body);

  const [race] = await db.select().from(racesTable).where(eq(racesTable.id, raceId));
  if (!race) { res.status(404).json({ error: "Race not found" }); return; }
  if (race.organizerId !== req.session.organizerId) { res.status(403).json({ error: "Not your race" }); return; }

  let preview;
  try {
    preview = await scrapeUrl(url);
  } catch (err: unknown) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Scrape failed" });
    return;
  }

  try {
    const result = await importFromPreview(raceId, preview);
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Import failed" });
  }
});

// ─── Async import (fire-and-forget + job polling) ───────────────────────────

router.post("/portal/races/:id/scrape-import-async", requireOrganizer, async (req, res) => {
  const raceId = parseInt(req.params["id"] as string, 10);
  const { url } = ScrapeUrlInput.parse(req.body);

  const [race] = await db.select().from(racesTable).where(eq(racesTable.id, raceId));
  if (!race) { res.status(404).json({ error: "Race not found" }); return; }
  if (race.organizerId !== req.session.organizerId) { res.status(403).json({ error: "Not your race" }); return; }

  // Scrape first (fast), then dispatch the DB-heavy import as a background job
  let preview;
  try {
    preview = await scrapeUrl(url);
  } catch (err: unknown) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Scrape failed" });
    return;
  }

  const job = startImportJob(raceId, preview);
  logger.info({ jobId: job.id, raceId, total: job.total }, "Async import job started");
  res.status(202).json({ jobId: job.id, total: job.total });
});

// ─── Job status polling ─────────────────────────────────────────────────────

router.get("/portal/jobs/:jobId", requireOrganizer, (req, res) => {
  const jobId = req.params["jobId"] as string;
  const job = getJob(jobId);
  if (!job) { res.status(404).json({ error: "Job not found or expired" }); return; }
  res.json({
    id: job.id,
    status: job.status,
    processed: job.processed,
    total: job.total,
    result: job.result ?? null,
    error: job.error ?? null,
  });
});

// ─── Auto-search ────────────────────────────────────────────────────────────

router.post("/portal/races/:id/auto-search", requireOrganizer, async (req, res) => {
  const raceId = parseInt(req.params["id"] as string, 10);
  const [race] = await db.select().from(racesTable).where(eq(racesTable.id, raceId));
  if (!race) { res.status(404).json({ error: "Race not found" }); return; }
  if (race.organizerId !== req.session.organizerId) { res.status(403).json({ error: "Not your race" }); return; }

  const candidates = await searchForRaceResults(race.name, race.date);
  res.json({ raceName: race.name, raceDate: race.date, candidates });
});

// ─── Auto-import (search + import best match) ───────────────────────────────

router.post("/portal/races/:id/auto-import", requireOrganizer, async (req, res) => {
  const raceId = parseInt(req.params["id"] as string, 10);
  const [race] = await db.select().from(racesTable).where(eq(racesTable.id, raceId));
  if (!race) { res.status(404).json({ error: "Race not found" }); return; }
  if (race.organizerId !== req.session.organizerId) { res.status(403).json({ error: "Not your race" }); return; }

  const candidates = await searchForRaceResults(race.name, race.date);
  const best = candidates.find(c => c.confidence === "high") ?? candidates.find(c => c.confidence === "medium");

  if (!best) {
    res.status(422).json({
      error: `No results pages found for "${race.name}" (${race.date}). Try the manual URL import instead.`,
    });
    return;
  }

  logger.info({ raceId, url: best.url, confidence: best.confidence }, "Auto-importing from discovered URL");

  let preview;
  try {
    preview = await scrapeUrl(best.url);
  } catch (err: unknown) {
    res.status(422).json({ error: `Found a candidate page but could not scrape it: ${err instanceof Error ? err.message : "Scrape failed"}` });
    return;
  }

  try {
    const result = await importFromPreview(raceId, preview);
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Import failed" });
  }
});

export default router;
