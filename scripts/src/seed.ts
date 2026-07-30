import { db, racesTable, resultsTable, runnersTable } from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";

type SeedRunner = {
  name: string;
  country: string;
  countryCode: string;
  gender: "M" | "F";
  age: number;
  birthYear: number;
  ageCategory: string;
  bio: string;
  hiddenAbility: number;
};

type SeedRace = {
  name: string;
  location: string;
  country: string;
  countryCode: string;
  date: string;
  distanceKm: string;
  category: string;
  surface: string;
  totalElevationM: number;
  description: string;
  status: string;
  weatherConditions: string;
  technicalityRating: number;
  difficultyScore: string;
};

type SeededResult = {
  runnerId: number;
  raceId: number;
  position: number;
  finishTimeSeconds: number;
  dnf: boolean;
};

const seedKey = "ultraranker-dynamic-season-v4";

// Helper to pick a random item from an array
function sample<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate dynamic, multi-tier runner profiles
function generateRunners(count: number): SeedRunner[] {
  const firstNames = [
    "Alex", "Sam", "Jordan", "Taylor", "Morgan", "Chris", "Pat", "Riley", "Casey", 
    "Jamie", "Elena", "Marcus", "Kaito", "Suleiman", "Chloe", "Mateo", "Aiko", 
    "Sofia", "Lukas", "Nadia", "Henrik", "Priya", "Javier", "Leila", "Tariq"
  ];
  const lastNames = [
    "Smith", "García", "Kim", "Müller", "Nyang", "Rossi", "Tanaka", "Silva", 
    "Kowalski", "Chen", "Dubois", "Larsen", "Alvarez", "Njoroge", "Weber", "Novak"
  ];
  const countries = [
    { country: "United States", code: "US" },
    { country: "France", code: "FR" },
    { country: "Spain", code: "ES" },
    { country: "Japan", code: "JP" },
    { country: "Kenya", code: "KE" },
    { country: "United Kingdom", code: "GB" },
    { country: "Switzerland", code: "CH" },
    { country: "Norway", code: "NO" },
    { country: "Canada", code: "CA" },
    { country: "Germany", code: "DE" }
  ];

  const generated: SeedRunner[] = [];

  for (let i = 0; i < count; i++) {
    const fn = sample(firstNames);
    const ln = sample(lastNames);
    const c = sample(countries);
    const gender: "M" | "F" = Math.random() > 0.5 ? "M" : "F";
    const birthYear = 1975 + Math.floor(Math.random() * 30); // Ages ~21 to 51
    const currentYear = 2026;
    const age = currentYear - birthYear;

    // Ability distribution: Gaussian-like distribution (most runners 50-75, few elites 90-98)
    const rawAbility = (Math.random() + Math.random() + Math.random()) / 3;
    const hiddenAbility = Math.round(45 + rawAbility * 53); // Range: 45 to 98

    generated.push({
      name: `${fn} ${ln} ${i + 1}`,
      country: c.country,
      countryCode: c.code,
      gender,
      age,
      birthYear,
      ageCategory: `${Math.floor(age / 5) * 5}-${Math.floor(age / 5) * 5 + 4}`,
      bio: "Automated test participant.",
      hiddenAbility,
    });
  }

  return generated;
}

const races: SeedRace[] = [
  { name: "North Peak Spring 50K", location: "Whistler", country: "Canada", countryCode: "CA", date: "2026-03-14", distanceKm: "50", category: "ultra", surface: "trail", totalElevationM: 2400, description: "Early-season mountain race with cold starts and long climbs.", status: "completed", weatherConditions: "Cold morning, damp forest trails", technicalityRating: 6, difficultyScore: "1.184" },
  { name: "Red Canyon 60K", location: "St. George", country: "United States", countryCode: "US", date: "2026-04-11", distanceKm: "60", category: "ultra", surface: "desert", totalElevationM: 1500, description: "Desert race with exposed ridgelines and fast runnable sections.", status: "completed", weatherConditions: "Dry, warm afternoon, light wind", technicalityRating: 5, difficultyScore: "1.142" },
  { name: "Alpine Crest 80K", location: "Chamonix", country: "France", countryCode: "FR", date: "2026-05-09", distanceKm: "80", category: "ultra", surface: "mountain", totalElevationM: 4200, description: "Big alpine day with sustained climbs and technical descents.", status: "completed", weatherConditions: "Cool, mixed cloud, occasional rain", technicalityRating: 9, difficultyScore: "1.336" },
  { name: "Lakeside Night 50 Mile", location: "Rotorua", country: "New Zealand", countryCode: "NZ", date: "2026-06-06", distanceKm: "80.5", category: "ultra", surface: "trail", totalElevationM: 2100, description: "Night-heavy loop race with runnable volcanic trails.", status: "completed", weatherConditions: "Cool night, humid dawn", technicalityRating: 7, difficultyScore: "1.228" },
  { name: "Granite Ridge 100K", location: "Bend", country: "United States", countryCode: "US", date: "2026-06-27", distanceKm: "100", category: "ultra", surface: "trail", totalElevationM: 3200, description: "Classic summer 100K over rolling pine forest and lava rock.", status: "completed", weatherConditions: "Warm, dry, clear skies", technicalityRating: 6, difficultyScore: "1.268" },
  { name: "High Pass 100 Mile", location: "Leadville", country: "United States", countryCode: "US", date: "2026-07-18", distanceKm: "160.9", category: "ultra", surface: "mountain", totalElevationM: 5600, description: "High-altitude endurance test with thin air and steep climbs.", status: "completed", weatherConditions: "Cold nights, variable mountain weather", technicalityRating: 9, difficultyScore: "1.494" },
  { name: "Summer Solstice 50K", location: "Oslo", country: "Norway", countryCode: "NO", date: "2026-08-01", distanceKm: "50", category: "ultra", surface: "trail", totalElevationM: 1700, description: "Fast midsummer trail race with a few technical sections.", status: "completed", weatherConditions: "Mild, bright, light showers", technicalityRating: 6, difficultyScore: "1.168" },
  { name: "Coastal Dunes 70K", location: "Cape Town", country: "South Africa", countryCode: "ZA", date: "2026-08-29", distanceKm: "70", category: "ultra", surface: "coastal", totalElevationM: 1900, description: "Windy coastal course with sand, cliffs, and exposed turns.", status: "completed", weatherConditions: "Windy, salty air, bright sun", technicalityRating: 7, difficultyScore: "1.214" },
  { name: "Autumn Divide 100K", location: "Queenstown", country: "New Zealand", countryCode: "NZ", date: "2026-09-26", distanceKm: "100", category: "ultra", surface: "mountain", totalElevationM: 4500, description: "Technical mountain race through fast-changing autumn weather.", status: "completed", weatherConditions: "Cold front, rain squalls, slippery trails", technicalityRating: 9, difficultyScore: "1.392" },
  { name: "Harvest Valley 100 Mile", location: "Lake Tahoe", country: "United States", countryCode: "US", date: "2026-10-24", distanceKm: "160.9", category: "ultra", surface: "trail", totalElevationM: 6100, description: "Season finale with long climbs, night running, and heavy fatigue.", status: "completed", weatherConditions: "Cold nights, clear day, frosty morning", technicalityRating: 8, difficultyScore: "1.538" },
];

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(value: string): number {
  return (hashString(value) % 10000) / 10000;
}

function weatherPenalty(weather: string): number {
  const lower = weather.toLowerCase();
  let penalty = 0;
  if (lower.includes("cold")) penalty += 140;
  if (lower.includes("wind")) penalty += 120;
  if (lower.includes("rain")) penalty += 180;
  if (lower.includes("showers")) penalty += 80;
  if (lower.includes("humid")) penalty += 90;
  if (lower.includes("heat") || lower.includes("warm")) penalty += 110;
  if (lower.includes("snow")) penalty += 240;
  if (lower.includes("frost")) penalty += 100;
  return penalty;
}

function computeRaceBaseTime(race: SeedRace): number {
  const distance = Number(race.distanceKm);
  const elevationFactor = race.totalElevationM * 0.72;
  const technicalFactor = race.technicalityRating * 260;
  const weatherFactor = weatherPenalty(race.weatherConditions);
  return Math.round(distance * 360 + elevationFactor + technicalFactor + weatherFactor);
}

function abilityWeightForRace(race: SeedRace): number {
  const distance = Number(race.distanceKm);
  return Math.round(48 + distance * 1.55 + race.totalElevationM / 65 + race.technicalityRating * 18);
}

/**
 * Dynamically builds results based on realistic participation, performance variance, and DNF chances.
 */
function buildDynamicSeedResults(
  insertedRunners: Array<{ id: number; name: string; hiddenAbility: number }>,
  insertedRaces: Array<{ id: number; name: string; date: string; distanceKm: string; totalElevationM: number; technicalityRating: number; weatherConditions: string }>
): SeededResult[] {
  const raw: Array<Omit<SeededResult, "position">> = [];

  insertedRaces.forEach((race) => {
    const baseTime = computeRaceBaseTime(race as any);
    const abilityWeight = abilityWeightForRace(race as any);

    insertedRunners.forEach((runner) => {
      // 1. Dynamic Participation (~30-45% chance per runner to enter a race)
      const participationChance = 0.25 + (runner.hiddenAbility / 220);
      const raceHash = seededUnit(`${seedKey}|${runner.id}|${race.id}`);

      if (raceHash <= participationChance) {
        // 2. Introduce DNF Chance (~3-5% chance of DNFing)
        const dnfRoll = seededUnit(`dnf|${seedKey}|${runner.id}|${race.id}`);
        const isDnf = dnfRoll < 0.04;

        // 3. Performance Variance
        const varianceFactor = (100 - runner.hiddenAbility) * 16;
        const noise = (seededUnit(`time|${seedKey}|${runner.id}|${race.id}`) - 0.5) * varianceFactor;

        const finishTimeSeconds = isDnf
          ? 0
          : Math.max(3600, Math.round(baseTime + (100 - runner.hiddenAbility) * abilityWeight + noise));

        raw.push({
          runnerId: runner.id,
          raceId: race.id,
          finishTimeSeconds,
          dnf: isDnf,
        });
      }
    });
  });

  // Group by race, sort finishers by time, and assign positions (DNFs at the end)
  const byRaceId = new Map<number, typeof raw>();
  for (const result of raw) {
    const bucket = byRaceId.get(result.raceId) ?? [];
    bucket.push(result);
    byRaceId.set(result.raceId, bucket);
  }

  const ordered: SeededResult[] = [];
  for (const entries of byRaceId.values()) {
    const sorted = entries.slice().sort((a, b) => {
      if (a.dnf && !b.dnf) return 1;
      if (!a.dnf && b.dnf) return -1;
      return a.finishTimeSeconds - b.finishTimeSeconds;
    });

    sorted.forEach((entry, index) => {
      ordered.push({
        ...entry,
        position: entry.dnf ? 0 : index + 1,
      });
    });
  }

  return ordered;
}

async function main() {
  const { importFromPreview } = await import("../../artifacts/api-server/src/lib/pipeline");

  // Generate 120 dynamic runners to build competitive race fields
  const runners = generateRunners(120);

  const { insertedRunners, insertedRaces } = await db.transaction(async (tx) => {
    const existingRunnerIds = await tx
      .select({ id: runnersTable.id })
      .from(runnersTable)
      .where(inArray(runnersTable.name, runners.map((runner) => runner.name)));

    const existingRaceIds = await tx
      .select({ id: racesTable.id })
      .from(racesTable)
      .where(inArray(racesTable.name, races.map((race) => race.name)));

    const runnerIds = existingRunnerIds.map((runner) => runner.id);
    const raceIds = existingRaceIds.map((race) => race.id);

    if (runnerIds.length || raceIds.length) {
      if (runnerIds.length && raceIds.length) {
        await tx.delete(resultsTable).where(or(inArray(resultsTable.runnerId, runnerIds), inArray(resultsTable.raceId, raceIds)));
      } else if (runnerIds.length) {
        await tx.delete(resultsTable).where(inArray(resultsTable.runnerId, runnerIds));
      } else {
        await tx.delete(resultsTable).where(inArray(resultsTable.raceId, raceIds));
      }

      if (raceIds.length) {
        await tx.delete(racesTable).where(inArray(racesTable.id, raceIds));
      }

      if (runnerIds.length) {
        await tx.delete(runnersTable).where(inArray(runnersTable.id, runnerIds));
      }
    }

    const insertedRunners = await tx.insert(runnersTable).values(
      runners.map(({ hiddenAbility, ...runner }) => ({ ...runner, rating: "200", ratingChange: "0" })),
    ).returning();

    const insertedRaces = await tx.insert(racesTable).values(races).returning();

    // Map hidden ability back to inserted runner objects
    const runnerWithAbility = insertedRunners.map((r, i) => ({
      ...r,
      hiddenAbility: runners[i].hiddenAbility,
    }));

    return { insertedRunners: runnerWithAbility, insertedRaces };
  });

  const results = buildDynamicSeedResults(insertedRunners, insertedRaces as any);
  const runnerById = new Map(insertedRunners.map((r) => [r.id, r]));

  const resultsByRaceId = new Map<number, SeededResult[]>();
  for (const result of results) {
    const bucket = resultsByRaceId.get(result.raceId) ?? [];
    bucket.push(result);
    resultsByRaceId.set(result.raceId, bucket);
  }

  // Process races in chronological order so ratings compound correctly over time
  const orderedRaces = insertedRaces
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const race of orderedRaces) {
    const raceResults = resultsByRaceId.get(race.id) ?? [];

    const preview = {
      source: "seed",
      raceName: race.name,
      results: raceResults.map((r) => ({
        runnerName: runnerById.get(r.runnerId)!.name,
        position: r.position,
        finishTimeSeconds: r.finishTimeSeconds,
        dnf: r.dnf,
        birthYear: null,
        gender: null,
        country: null,
        ageCategory: null,
      })),
    };

    await importFromPreview(race.id, preview as any);
  }

  console.log(`Seeded ${insertedRunners.length} runners, ${insertedRaces.length} races, and ${results.length} results via the real Elo pipeline.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});