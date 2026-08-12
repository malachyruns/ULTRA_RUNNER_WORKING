import { Router } from "express";
import { db, syncJobsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { requireOrganizer } from "../middleware/requireOrganizer";
import { pauseRunSignupSync, resumeRunSignupSync, startRunSignupSync } from "../lib/runsignup/ingestion";

const router = Router();
const startInput = z.object({ mode: z.enum(["historical", "incremental", "single"]), identifier: z.string().trim().min(1).optional() }).refine(v => v.mode !== "single" || v.identifier, { message: "identifier is required for a single import" });

router.post("/portal/runsignup/jobs", requireOrganizer, async (req, res) => {
  const body = startInput.parse(req.body);
  const job = await startRunSignupSync(body.mode, body.identifier, req.session.organizerId!);
  res.status(202).json(job);
});
router.get("/portal/runsignup/jobs/latest", requireOrganizer, async (req, res) => {
  const [job] = await db.select().from(syncJobsTable)
    .where(eq(syncJobsTable.organizerId, req.session.organizerId!))
    .orderBy(desc(syncJobsTable.id)).limit(1);
  if (!job) { res.status(404).json({ error: "No RunSignup jobs found" }); return; }
  res.json(job);
});
router.get("/portal/runsignup/jobs/:id", requireOrganizer, async (req, res) => {
  const [job] = await db.select().from(syncJobsTable).where(and(eq(syncJobsTable.id, Number(req.params.id)), eq(syncJobsTable.organizerId, req.session.organizerId!)));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(job);
});
router.post("/portal/runsignup/jobs/:id/pause", requireOrganizer, async (req, res) => {
  const [job] = await db.select().from(syncJobsTable).where(and(eq(syncJobsTable.id, Number(req.params.id)), eq(syncJobsTable.organizerId, req.session.organizerId!)));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  await pauseRunSignupSync(job.id); res.status(202).json({ status: "pausing" });
});
router.post("/portal/runsignup/jobs/:id/resume", requireOrganizer, async (req, res) => {
  const [job] = await db.select().from(syncJobsTable).where(and(eq(syncJobsTable.id, Number(req.params.id)), eq(syncJobsTable.organizerId, req.session.organizerId!)));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  await resumeRunSignupSync(job.id); res.status(202).json({ status: "pending" });
});

export default router;
