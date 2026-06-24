import { Router } from "express";
import { db, racesTable, resultsTable, runnersTable } from "@workspace/db";
import { eq, desc, ilike, and } from "drizzle-orm";
import { z } from "zod";
import { requireOrganizer } from "../middleware/requireOrganizer";
import { scrapeUrl } from "../lib/scrapers";
import { computePoints } from "../lib/difficulty";
import { normalizeRace } from "./runners";
import { logger } from "../lib/logger";

const router = Router();

const ScrapePreviewInput = z.object({
  url: z.string().url(),
});

const ScrapeImportInput = z.object({
  url: z.string().url(),
});

// POST /portal/scrape — preview scraped results (no DB writes)
router.post("/portal/scrape", requireOrganizer, async (req, res) => {
  const { url } = ScrapePreviewInput.parse(req.body);
  try {
    const preview = await scrapeUrl(url);
    res.json(preview);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Scrape failed";
    logger.warn({ url, err: message }, "Scrape preview failed");
    res.status(422).json({ error: message });
  }
});

// POST /portal/races/:id/scrape-import — scrape and import results for a race
router.post("/portal/races/:id/scrape-import", requireOrganizer, async (req, res) => {
  const raceId = parseInt(req.params["id"] as string, 10);
  const { url } = ScrapeImportInput.parse(req.body);

  const [race] = await db.select().from(racesTable).where(eq(racesTable.id, raceId));
  if (!race) { res.status(404).json({ error: "Race not found" }); return; }
  if (race.organizerId !== req.session.organizerId) {
    res.status(403).json({ error: "Not your race" });
    return;
  }

  let preview;
  try {
    preview = await scrapeUrl(url);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Scrape failed";
    res.status(422).json({ error: message });
    return;
  }

  const difficultyScore = parseFloat(race.difficultyScore);
  const totalFinishers = preview.results.filter(r => !r.dnf).length;

  let runnersCreated = 0;
  let runnersUpdated = 0;
  let resultsCreated = 0;

  for (const entry of preview.results) {
    if (!entry.runnerName?.trim()) continue;

    const [existingRunner] = await db
      .select()
      .from(runnersTable)
      .where(ilike(runnersTable.name, entry.runnerName.trim()));

    let runnerId: number;

    if (existingRunner) {
      runnerId = existingRunner.id;
      runnersUpdated++;
    } else {
      const [newRunner] = await db.insert(runnersTable).values({
        name: entry.runnerName.trim(),
        country: entry.country ?? "Unknown",
        gender: entry.gender ?? "M",
        rating: "1000",
        rank: 0,
        totalRaces: 0,
        totalDistanceKm: "0",
      }).returning();
      runnerId = newRunner.id;
      runnersCreated++;
    }

    // Remove any existing result for this runner+race (idempotent import)
    await db.delete(resultsTable)
      .where(and(eq(resultsTable.runnerId, runnerId), eq(resultsTable.raceId, raceId)));

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

    // Update runner aggregates
    const allResults = await db.select().from(resultsTable).where(eq(resultsTable.runnerId, runnerId));
    const finishes = allResults.filter(r => !r.dnf && r.position);
    const bestFinish = finishes.length ? Math.min(...finishes.map(r => r.position!)) : null;
    const totalRaces = allResults.length;
    const totalPoints = allResults.reduce((acc, r) => acc + parseFloat(r.points), 0);

    await db.update(runnersTable).set({
      totalRaces,
      bestFinish,
      rating: String(1000 + totalPoints),
    }).where(eq(runnersTable.id, runnerId));
  }

  // Update race metadata
  await db.update(racesTable).set({
    status: "completed",
    finishersCount: totalFinishers,
  }).where(eq(racesTable.id, raceId));

  // Recompute global ranks
  const allRunners = await db.select().from(runnersTable).orderBy(desc(runnersTable.rating));
  for (let i = 0; i < allRunners.length; i++) {
    await db.update(runnersTable).set({ rank: i + 1 }).where(eq(runnersTable.id, allRunners[i].id));
  }

  res.json({
    resultsCreated,
    runnersCreated,
    runnersUpdated,
    difficultyScore,
    source: preview.source,
    raceName: preview.raceName,
  });
});

export default router;
