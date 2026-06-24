import { Router } from "express";
import { db, racesTable, resultsTable, runnersTable } from "@workspace/db";
import { eq, desc, asc, ilike, and, gte } from "drizzle-orm";
import {
  ListRacesQueryParams,
  GetRaceParams,
  CreateRaceBody,
  UpdateRaceParams,
  UpdateRaceBody,
  DeleteRaceParams,
  GetRaceResultsParams,
  ListUpcomingRacesQueryParams,
} from "@workspace/api-zod";
import { normalizeRace, normalizeResult, normalizeRunner } from "./runners";

const router = Router();

// GET /races
router.get("/races", async (req, res) => {
  const query = ListRacesQueryParams.parse(req.query);
  const conditions = [];
  if (query.status) conditions.push(eq(racesTable.status, query.status));
  if (query.category) conditions.push(eq(racesTable.category, query.category));
  if (query.country) conditions.push(eq(racesTable.country, query.country));
  if (query.search) conditions.push(ilike(racesTable.name, `%${query.search}%`));
  const rows = await db
    .select()
    .from(racesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(racesTable.date))
    .limit(query.limit ?? 100)
    .offset(query.offset ?? 0);
  res.json(rows.map(normalizeRace));
});

// POST /races
router.post("/races", async (req, res) => {
  const body = CreateRaceBody.parse(req.body);
  const [row] = await db.insert(racesTable).values({
    ...body,
    distanceKm: String(body.distanceKm),
  }).returning();
  res.status(201).json(normalizeRace(row));
});

// GET /races/upcoming
router.get("/races/upcoming", async (req, res) => {
  const query = ListUpcomingRacesQueryParams.parse(req.query);
  const today = new Date().toISOString().split("T")[0];
  const rows = await db
    .select()
    .from(racesTable)
    .where(and(eq(racesTable.status, "upcoming"), gte(racesTable.date, today)))
    .orderBy(asc(racesTable.date))
    .limit(query.limit ?? 10);
  res.json(rows.map(normalizeRace));
});

// GET /races/:id
router.get("/races/:id", async (req, res) => {
  const { id } = GetRaceParams.parse(req.params);
  const [row] = await db.select().from(racesTable).where(eq(racesTable.id, id));
  if (!row) { res.status(404).json({ error: "Race not found" }); return; }
  res.json(normalizeRace(row));
});

// PATCH /races/:id
router.patch("/races/:id", async (req, res) => {
  const { id } = UpdateRaceParams.parse(req.params);
  const body = UpdateRaceBody.parse(req.body);
  const updateData: Record<string, unknown> = { ...body };
  if (body.distanceKm !== undefined) updateData.distanceKm = String(body.distanceKm);
  const [row] = await db.update(racesTable).set(updateData).where(eq(racesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Race not found" }); return; }
  res.json(normalizeRace(row));
});

// DELETE /races/:id
router.delete("/races/:id", async (req, res) => {
  const { id } = DeleteRaceParams.parse(req.params);
  await db.delete(racesTable).where(eq(racesTable.id, id));
  res.status(204).end();
});

// GET /races/:id/results
router.get("/races/:id/results", async (req, res) => {
  const { id } = GetRaceResultsParams.parse(req.params);
  const rows = await db
    .select()
    .from(resultsTable)
    .innerJoin(runnersTable, eq(resultsTable.runnerId, runnersTable.id))
    .where(eq(resultsTable.raceId, id))
    .orderBy(asc(resultsTable.position));
  res.json(rows.map(({ results, runners }) => ({
    ...normalizeResult(results),
    runner: normalizeRunner(runners),
  })));
});

export default router;
