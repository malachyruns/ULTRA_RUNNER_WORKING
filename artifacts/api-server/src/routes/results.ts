import { Router } from "express";
import { db, resultsTable, runnersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateResultBody,
  UpdateResultParams,
  UpdateResultBody,
  DeleteResultParams,
} from "@workspace/api-zod";
import { normalizeResult } from "./runners";

const router = Router();

function computePoints(position: number | null | undefined, dnf: boolean, totalFinishers: number): number {
  if (dnf || !position) return 0;
  const base = 1000;
  const factor = Math.max(0, 1 - (position - 1) / Math.max(totalFinishers, 1));
  return Math.round(base * factor * 10) / 10;
}

// POST /results
router.post("/results", async (req, res) => {
  const body = CreateResultBody.parse(req.body);
  const points = computePoints(body.position ?? null, body.dnf ?? false, 50);

  const [row] = await db.insert(resultsTable).values({
    ...body,
    points: String(points),
  }).returning();

  // Update runner aggregates
  const allResults = await db.select().from(resultsTable).where(eq(resultsTable.runnerId, body.runnerId));
  const finishes = allResults.filter(r => !r.dnf && r.position);
  const bestFinish = finishes.length ? Math.min(...finishes.map(r => r.position!)) : null;
  const totalRaces = allResults.length;
  const newRating = 1000 + allResults.reduce((acc, r) => acc + parseFloat(r.points), 0);

  await db.update(runnersTable).set({
    totalRaces,
    bestFinish,
    rating: String(newRating),
  }).where(eq(runnersTable.id, body.runnerId));

  // Recompute global ranks
  const allRunners = await db.select().from(runnersTable).orderBy(desc(runnersTable.rating));
  for (let i = 0; i < allRunners.length; i++) {
    await db.update(runnersTable).set({ rank: i + 1 }).where(eq(runnersTable.id, allRunners[i].id));
  }

  res.status(201).json(normalizeResult(row));
});

// PATCH /results/:id
router.patch("/results/:id", async (req, res) => {
  const { id } = UpdateResultParams.parse(req.params);
  const body = UpdateResultBody.parse(req.body);
  const [row] = await db.update(resultsTable).set(body).where(eq(resultsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Result not found" }); return; }
  res.json(normalizeResult(row));
});

// DELETE /results/:id
router.delete("/results/:id", async (req, res) => {
  const { id } = DeleteResultParams.parse(req.params);
  await db.delete(resultsTable).where(eq(resultsTable.id, id));
  res.status(204).end();
});

export default router;
