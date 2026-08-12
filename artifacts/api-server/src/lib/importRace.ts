import { db, resultsTable, runnersTable, racesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

export interface ImportResult {
  runnerName: string;
  country?: string | null;
  gender?: string | null;
  position?: number | null;
  finishTimeSeconds?: number | null;
  dnf?: boolean;
}

export async function importRaceResults(
  raceId: number,
  results: ImportResult[],
  difficultyScore: number,
) {
  let runnersCreated = 0;
  let runnersUpdated = 0;
  let resultsCreated = 0;

  for (const entry of results) {

    const existing = await db
      .select()
      .from(runnersTable)
      .where(eq(runnersTable.name, entry.runnerName.trim()));

    let runnerId: number;

    if (existing.length > 0) {
      runnerId = existing[0].id;
      runnersUpdated++;
    } else {

      const [runner] = await db.insert(runnersTable).values({
        name: entry.runnerName.trim(),
        country: entry.country ?? "Unknown",
        gender: entry.gender ?? "M",
        rating: "1000",
        rank: 0,
        totalRaces: 0,
        totalDistanceKm: "0",
      }).returning();

      runnerId = runner.id;
      runnersCreated++;
    }


    await db.delete(resultsTable)
      .where(
        and(
          eq(resultsTable.runnerId, runnerId),
          eq(resultsTable.raceId, raceId)
        )
      );


    // Temporary scoring system
    // We will replace this with your Elo algorithm next
    const points =
      entry.dnf
        ? 0
        : Math.max(0, 1000 - ((entry.position ?? 999) * 10));


    await db.insert(resultsTable).values({
      runnerId,
      raceId,
      position: entry.position ?? null,
      finishTimeSeconds: entry.finishTimeSeconds ?? null,
      dnf: entry.dnf ?? false,
      points: String(points),
    });


    resultsCreated++;


    const allResults = await db
      .select()
      .from(resultsTable)
      .where(eq(resultsTable.runnerId, runnerId));


    const totalPoints = allResults.reduce(
      (sum, r) => sum + Number(r.points),
      0
    );


    await db.update(runnersTable)
      .set({
        totalRaces: allResults.length,
        rating: String(1000 + totalPoints),
      })
      .where(eq(runnersTable.id, runnerId));

  }


  await db.update(racesTable)
    .set({
      status: "completed",
      finishersCount: results.filter(r => !r.dnf).length,
    })
    .where(eq(racesTable.id, raceId));


  const allRunners = await db
    .select()
    .from(runnersTable)
    .orderBy(desc(runnersTable.rating));


  for (let i = 0; i < allRunners.length; i++) {
    await db.update(runnersTable)
      .set({
        rank: i + 1,
      })
      .where(eq(runnersTable.id, allRunners[i].id));
  }


  return {
    resultsCreated,
    runnersCreated,
    runnersUpdated,
    difficultyScore,
  };
}