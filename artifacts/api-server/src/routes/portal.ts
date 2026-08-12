import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, organizersTable, racesTable, resultsTable, runnersTable } from "@workspace/db";
import { eq, desc, and, ilike } from "drizzle-orm";
import {
  PortalRegisterBody,
  PortalLoginBody,
  PortalCreateRaceBody,
  PortalUpdateRaceParams,
  PortalUpdateRaceBody,
  PortalSubmitResultsParams,
  PortalSubmitResultsBody,
} from "@workspace/api-zod";
import { requireOrganizer } from "../middleware/requireOrganizer";
import { computeDifficultyScore} from "../lib/difficulty";
import { normalizeRunner, normalizeRace } from "./runners";
import { importRaceResults } from "../lib/importRace";
import { scrapeUrl } from "../lib/scrapers";
import { evaluateRankingEligibility } from "../lib/eligibility";

const router = Router();

function normalizeOrganizer(o: typeof organizersTable.$inferSelect) {
  return {
    id: o.id,
    name: o.name,
    email: o.email,
    organizationName: o.organizationName,
    website: o.website ?? null,
    isVerified: o.isVerified,
    createdAt: o.createdAt.toISOString(),
  };
}

// POST /portal/register
router.post("/portal/register", async (req, res) => {
  const body = PortalRegisterBody.parse(req.body);
  const existing = await db.select().from(organizersTable).where(eq(organizersTable.email, body.email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await bcrypt.hash(body.password, 12);
  const [organizer] = await db.insert(organizersTable).values({
    name: body.name,
    email: body.email,
    passwordHash,
    organizationName: body.organizationName,
    website: body.website ?? null,
    isVerified: false,
  }).returning();
  req.session.organizerId = organizer.id;
  res.status(201).json(normalizeOrganizer(organizer));
});

// POST /portal/login
router.post("/portal/login", async (req, res) => {
  const body = PortalLoginBody.parse(req.body);
  const [organizer] = await db.select().from(organizersTable).where(eq(organizersTable.email, body.email));
  if (!organizer) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const valid = await bcrypt.compare(body.password, organizer.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  req.session.organizerId = organizer.id;
  res.json(normalizeOrganizer(organizer));
});

// POST /portal/logout
router.post("/portal/logout", (req, res) => {
  req.session.destroy(() => {
    res.status(204).end();
  });
});

// GET /portal/me
router.get("/portal/me", requireOrganizer, async (req, res) => {
  const [organizer] = await db.select().from(organizersTable).where(eq(organizersTable.id, req.session.organizerId!));
  if (!organizer) { res.status(401).json({ error: "Not authenticated" }); return; }
  res.json(normalizeOrganizer(organizer));
});

// GET /portal/races
router.get("/portal/races", requireOrganizer, async (req, res) => {
  const races = await db
    .select()
    .from(racesTable)
    .where(eq(racesTable.organizerId, req.session.organizerId!))
    .orderBy(desc(racesTable.date));
  res.json(races.map(r => normalizeRace(r)));
});

// POST /portal/races
router.post("/portal/races", requireOrganizer, async (req, res) => {
  const body = PortalCreateRaceBody.parse(req.body);
  const eligibility = evaluateRankingEligibility({ distance: body.distanceKm, distanceUnits: "K", name: body.name });
  if (!eligibility.eligible) { res.status(422).json({ error: eligibility.reason }); return; }
  const difficultyScore = computeDifficultyScore({
    surface: body.surface,
    totalElevationM: body.totalElevationM,
    distanceKm: body.distanceKm,
    weatherConditions: body.weatherConditions as "clear" | "rain" | "heat" | "snow" | "storm" | null | undefined,
    technicalityRating: body.technicalityRating,
  });
  const [race] = await db.insert(racesTable).values({
    name: body.name,
    location: body.location,
    country: body.country,
    countryCode: body.countryCode ?? null,
    date: body.date,
    distanceKm: String(body.distanceKm),
    category: body.category,
    surface: body.surface,
    totalElevationM: body.totalElevationM ?? null,
    description: body.description ?? null,
    weatherConditions: body.weatherConditions ?? null,
    technicalityRating: body.technicalityRating ?? null,
    difficultyScore: String(difficultyScore),
    status: "upcoming",
    organizerId: req.session.organizerId!,
  }).returning();
  res.status(201).json(normalizeRace(race));
});

// POST /portal/races/scrape-create-import
// Scrape a race URL, auto-create the race using scraped metadata
// (falling back to anything explicitly provided in the request body),
// then import the scraped results.
router.post("/portal/races/scrape-create-import", requireOrganizer, async (req, res) => {
  try {
    const { url, ...raceData } = req.body;

    if (!url) {
      res.status(400).json({ error: "URL is required" });
      return;
    }

    const preview = await scrapeUrl(url);

    if (!preview.results.length) {
      res.status(422).json({ error: "No results found on this page" });
      return;
    }

    const distanceKm = raceData.distanceKm ?? preview.raceDistanceKm ?? 0;
    const eligibility = evaluateRankingEligibility({ distance: distanceKm, distanceUnits: "K", name: raceData.name ?? preview.raceName });
    if (!eligibility.eligible) { res.status(422).json({ error: eligibility.reason }); return; }
    const surface = raceData.surface ?? preview.raceSurface ?? "trail";

    const difficultyScore = computeDifficultyScore({
      surface,
      totalElevationM: raceData.totalElevationM,
      distanceKm,
      weatherConditions: raceData.weatherConditions,
      technicalityRating: raceData.technicalityRating,
    });

    const [race] = await db.insert(racesTable).values({
      name: raceData.name ?? preview.raceName ?? "Unknown Race",
      location: raceData.location ?? preview.raceLocation ?? "Unknown",
      country: raceData.country ?? preview.raceCountry ?? "Unknown",
      countryCode: raceData.countryCode ?? preview.raceCountryCode ?? null,
      date: raceData.date ?? preview.raceDate ?? new Date().toISOString().split("T")[0],
      distanceKm: String(distanceKm),
      category: raceData.category ?? "ultra",
      surface,
      totalElevationM: raceData.totalElevationM ?? null,
      description: raceData.description ?? null,
      weatherConditions: raceData.weatherConditions ?? null,
      technicalityRating: raceData.technicalityRating ?? null,
      difficultyScore: String(difficultyScore),
      status: "completed",
      organizerId: req.session.organizerId!,
    }).returning();

    const importSummary = await importRaceResults(race.id, preview.results, difficultyScore);

    res.status(201).json({
      raceId: race.id,
      raceName: race.name,
      source: preview.source,
      ...importSummary,
    });
  } catch (error) {
    console.error("Scrape import failed:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Scrape import failed",
    });
  }
});

// PATCH /portal/races/:id
router.patch("/portal/races/:id", requireOrganizer, async (req, res) => {
  const { id } = PortalUpdateRaceParams.parse(req.params);
  const [existing] = await db.select().from(racesTable).where(eq(racesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Race not found" }); return; }
  if (existing.organizerId !== req.session.organizerId) {
    res.status(403).json({ error: "Not your race" });
    return;
  }
  const body = PortalUpdateRaceBody.parse(req.body);
  const updateData: Record<string, unknown> = { ...body };
  if (body.distanceKm !== undefined) updateData.distanceKm = String(body.distanceKm);

  // Recompute difficulty if any factor changed
  const merged = { ...existing, ...body };
  const difficultyScore = computeDifficultyScore({
    surface: merged.surface,
    totalElevationM: merged.totalElevationM,
    distanceKm: Number(merged.distanceKm),
    weatherConditions: merged.weatherConditions as "clear" | "rain" | "heat" | "snow" | "storm" | null | undefined,
    technicalityRating: merged.technicalityRating,
  });
  updateData.difficultyScore = String(difficultyScore);

  const [updated] = await db.update(racesTable).set(updateData).where(eq(racesTable.id, id)).returning();
  res.json(normalizeRace(updated));
});

// POST /portal/races/:id/results — bulk submit finisher list
router.post("/portal/races/:id/results", requireOrganizer, async (req, res) => {
  const { id: raceId } = PortalSubmitResultsParams.parse(req.params);
  const { results } = PortalSubmitResultsBody.parse(req.body);

  const [race] = await db.select().from(racesTable).where(eq(racesTable.id, raceId));
  if (!race) { res.status(404).json({ error: "Race not found" }); return; }
  if (race.organizerId !== req.session.organizerId) {
    res.status(403).json({ error: "Not your race" });
    return;
  }

  const difficultyScore = parseFloat(race.difficultyScore);
  const totalFinishers = results.filter(r => !r.dnf).length;

  const importSummary = await importRaceResults(
    raceId,
    results,
    difficultyScore
  );

  // Update race metadata
  await db.update(racesTable).set({
    status: "completed",
    finishersCount: totalFinishers,
  }).where(eq(racesTable.id, raceId));

  // Recompute all global ranks
  const allRunners = await db.select().from(runnersTable).orderBy(desc(runnersTable.rating));
  for (let i = 0; i < allRunners.length; i++) {
    await db.update(runnersTable).set({ rank: i + 1 }).where(eq(runnersTable.id, allRunners[i].id));
  }

  res.json(importSummary);
});

export default router;
