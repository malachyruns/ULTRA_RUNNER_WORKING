import { Router } from "express";
import { db, runnersTable, racesTable, resultsTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { GetRecentActivityQueryParams } from "@workspace/api-zod";
import { normalizeRunner } from "./runners";

const router = Router();

// GET /stats/summary
router.get("/stats/summary", async (req, res) => {
  const [runnerCount] = await db.select({ count: sql<number>`count(*)` }).from(runnersTable);
  const [raceCount] = await db.select({ count: sql<number>`count(*)` }).from(racesTable);
  const [resultCount] = await db.select({ count: sql<number>`count(*)` }).from(resultsTable);
  const [countryCount] = await db.select({ count: sql<number>`count(distinct country)` }).from(runnersTable);

  const topRunners = await db.select().from(runnersTable).orderBy(desc(runnersTable.rating)).limit(1);
  const topRatedRunner = topRunners[0] ? normalizeRunner(topRunners[0]) : null;

  res.json({
    totalRunners: Number(runnerCount.count),
    totalRaces: Number(raceCount.count),
    totalResults: Number(resultCount.count),
    totalCountries: Number(countryCount.count),
    topRatedRunner,
  });
});

// GET /stats/recent-activity
router.get("/stats/recent-activity", async (req, res) => {
  const query = GetRecentActivityQueryParams.parse(req.query);
  const rows = await db
    .select()
    .from(resultsTable)
    .innerJoin(runnersTable, eq(resultsTable.runnerId, runnersTable.id))
    .innerJoin(racesTable, eq(resultsTable.raceId, racesTable.id))
    .orderBy(desc(resultsTable.createdAt))
    .limit(query.limit ?? 20);

  res.json(rows.map(({ results, runners, races }) => ({
    id: results.id,
    runnerId: results.runnerId,
    raceId: results.raceId,
    runnerName: runners.name,
    runnerCountry: runners.country,
    raceName: races.name,
    raceDate: races.date,
    raceCategory: races.category,
    position: results.position ?? null,
    finishTimeSeconds: results.finishTimeSeconds ?? null,
    dnf: results.dnf,
    points: parseFloat(results.points),
  })));
});

export default router;
