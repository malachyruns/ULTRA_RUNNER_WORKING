import { db, runnersTable, resultsTable, racesTable } from "./src";

async function reset() {
  await db.delete(resultsTable);
  await db.delete(runnersTable);
  await db.delete(racesTable);
  console.log("Runners, races, and results cleared.");
  process.exit(0);
}

reset();