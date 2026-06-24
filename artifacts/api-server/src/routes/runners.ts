import { Router } from "express";
import { db, runnersTable, resultsTable, racesTable } from "@workspace/db";
import { eq, desc, asc, ilike, or, sql, and } from "drizzle-orm";
import {
  ListRunnersQueryParams,
  GetRunnerParams,
  CreateRunnerBody,
  UpdateRunnerParams,
  UpdateRunnerBody,
  DeleteRunnerParams,
  GetRunnerResultsParams,
  GetRunnerStatsParams,
  GetLeaderboardQueryParams,
} from "@workspace/api-zod";

const router = Router();

// GET /runners
router.get("/runners", async (req, res) => {
  const query = ListRunnersQueryParams.parse(req.query);
  const conditions = [];
  if (query.gender) conditions.push(eq(runnersTable.gender, query.gender));
  if (query.country) conditions.push(eq(runnersTable.country, query.country));
  if (query.search) {
    conditions.push(ilike(runnersTable.name, `%${query.search}%`));
  }
  const rows = await db
    .select()
    .from(runnersTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(runnersTable.rank))
    .limit(query.limit ?? 100)
    .offset(query.offset ?? 0);
  res.json(rows.map(normalizeRunner));
});

// POST /runners
router.post("/runners", async (req, res) => {
  const body = CreateRunnerBody.parse(req.body);
  const [row] = await db.insert(runnersTable).values(body).returning();
  await recomputeRanks();
  const updated = await db.select().from(runnersTable).where(eq(runnersTable.id, row.id));
  res.status(201).json(normalizeRunner(updated[0]));
});

// GET /runners/leaderboard
router.get("/runners/leaderboard", async (req, res) => {
  const query = GetLeaderboardQueryParams.parse(req.query);
  const conditions = [];
  if (query.gender) conditions.push(eq(runnersTable.gender, query.gender));
  const rows = await db
    .select()
    .from(runnersTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(runnersTable.rating))
    .limit(query.limit ?? 50);
  res.json(rows.map((r, i) => ({
    ...normalizeRunner(r),
    rank: i + 1,
    ratingChange: Math.round((Math.random() * 40 - 20) * 10) / 10,
  })));
});

// GET /runners/:id
router.get("/runners/:id", async (req, res) => {
  const { id } = GetRunnerParams.parse(req.params);
  const [row] = await db.select().from(runnersTable).where(eq(runnersTable.id, id));
  if (!row) { res.status(404).json({ error: "Runner not found" }); return; }
  res.json(normalizeRunner(row));
});

// PATCH /runners/:id
router.patch("/runners/:id", async (req, res) => {
  const { id } = UpdateRunnerParams.parse(req.params);
  const body = UpdateRunnerBody.parse(req.body);
  const [row] = await db.update(runnersTable).set(body).where(eq(runnersTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Runner not found" }); return; }
  res.json(normalizeRunner(row));
});

// DELETE /runners/:id
router.delete("/runners/:id", async (req, res) => {
  const { id } = DeleteRunnerParams.parse(req.params);
  await db.delete(runnersTable).where(eq(runnersTable.id, id));
  res.status(204).end();
});

// GET /runners/:id/results
router.get("/runners/:id/results", async (req, res) => {
  const { id } = GetRunnerResultsParams.parse(req.params);
  const rows = await db
    .select()
    .from(resultsTable)
    .innerJoin(racesTable, eq(resultsTable.raceId, racesTable.id))
    .where(eq(resultsTable.runnerId, id))
    .orderBy(desc(racesTable.date));
  res.json(rows.map(({ results, races }) => ({
    ...normalizeResult(results),
    race: normalizeRace(races),
  })));
});

// GET /runners/:id/stats
router.get("/runners/:id/stats", async (req, res) => {
  const { id } = GetRunnerStatsParams.parse(req.params);
  const results = await db
    .select()
    .from(resultsTable)
    .innerJoin(racesTable, eq(resultsTable.raceId, racesTable.id))
    .where(eq(resultsTable.runnerId, id));

  const total = results.length;
  const finishes = results.filter(r => !r.results.dnf);
  const dnfs = results.filter(r => r.results.dnf);
  const positions = finishes.map(r => r.results.position).filter(Boolean) as number[];
  const avgPos = positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : null;
  const bestPos = positions.length ? Math.min(...positions) : null;
  const totalDist = results.reduce((acc, r) => acc + parseFloat(r.races.distanceKm), 0);
  const totalPoints = results.reduce((acc, r) => acc + parseFloat(r.results.points), 0);

  const byCategory: Record<string, { races: number; positions: number[] }> = {};
  for (const r of results) {
    const cat = r.races.category;
    if (!byCategory[cat]) byCategory[cat] = { races: 0, positions: [] };
    byCategory[cat].races++;
    if (!r.results.dnf && r.results.position) byCategory[cat].positions.push(r.results.position);
  }

  res.json({
    runnerId: id,
    totalRaces: total,
    totalFinishes: finishes.length,
    totalDnfs: dnfs.length,
    totalDistanceKm: totalDist,
    avgPosition: avgPos,
    bestPosition: bestPos,
    totalPoints,
    byCategory: Object.entries(byCategory).map(([category, data]) => ({
      category,
      races: data.races,
      avgPosition: data.positions.length ? data.positions.reduce((a, b) => a + b, 0) / data.positions.length : null,
    })),
  });
});

async function recomputeRanks() {
  const runners = await db.select().from(runnersTable).orderBy(desc(runnersTable.rating));
  for (let i = 0; i < runners.length; i++) {
    await db.update(runnersTable).set({ rank: i + 1 }).where(eq(runnersTable.id, runners[i].id));
  }
}

function normalizeRunner(r: typeof runnersTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    country: r.country,
    countryCode: r.countryCode ?? null,
    gender: r.gender,
    age: r.age ?? null,
    bio: r.bio ?? null,
    rating: parseFloat(r.rating),
    rank: r.rank,
    totalRaces: r.totalRaces,
    totalDistanceKm: parseFloat(r.totalDistanceKm),
    bestFinish: r.bestFinish ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

function normalizeRace(r: typeof racesTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    location: r.location,
    country: r.country,
    countryCode: r.countryCode ?? null,
    date: r.date,
    distanceKm: parseFloat(r.distanceKm),
    category: r.category,
    surface: r.surface,
    totalElevationM: r.totalElevationM ?? null,
    description: r.description ?? null,
    status: r.status,
    finishersCount: r.finishersCount ?? null,
    weatherConditions: r.weatherConditions ?? null,
    technicalityRating: r.technicalityRating ?? null,
    difficultyScore: parseFloat(r.difficultyScore),
    organizerId: r.organizerId ?? null,
    organizerName: null as string | null,
    createdAt: r.createdAt.toISOString(),
  };
}

function normalizeResult(r: typeof resultsTable.$inferSelect) {
  return {
    id: r.id,
    runnerId: r.runnerId,
    raceId: r.raceId,
    position: r.position ?? null,
    finishTimeSeconds: r.finishTimeSeconds ?? null,
    dnf: r.dnf,
    points: parseFloat(r.points),
    createdAt: r.createdAt.toISOString(),
  };
}

export { normalizeRunner, normalizeRace, normalizeResult };
export default router;
