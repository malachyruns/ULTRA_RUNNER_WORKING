import { db, racesTable, resultsTable, runnersTable } from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";
import { importFromPreview } from "../../artifacts/api-server/src/lib/pipeline";

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

const seedKey = "ultraranker-testing-season-v3";

const runners: SeedRunner[] = [
  { name: "Maya Chen", country: "United States", countryCode: "US", gender: "F", age: 29, birthYear: 1997, ageCategory: "25-29", bio: "Mountain runner with a patient uphill rhythm.", hiddenAbility: 93 },
  { name: "Eli Njoroge", country: "Kenya", countryCode: "KE", gender: "M", age: 34, birthYear: 1992, ageCategory: "30-34", bio: "Efficient climber who stays smooth on rolling courses.", hiddenAbility: 96 },
  { name: "Sofia Alvarez", country: "Spain", countryCode: "ES", gender: "F", age: 41, birthYear: 1985, ageCategory: "40-44", bio: "Experienced endurance runner with strong late-race pace.", hiddenAbility: 91 },
  { name: "Lukas Weber", country: "Germany", countryCode: "DE", gender: "M", age: 37, birthYear: 1989, ageCategory: "35-39", bio: "Technical trail specialist with a careful downhill style.", hiddenAbility: 88 },
  { name: "Aiko Tanaka", country: "Japan", countryCode: "JP", gender: "F", age: 31, birthYear: 1995, ageCategory: "30-34", bio: "Compact, efficient runner who thrives on steep gradients.", hiddenAbility: 94 },
  { name: "Mateo Silva", country: "Brazil", countryCode: "BR", gender: "M", age: 28, birthYear: 1998, ageCategory: "25-29", bio: "Heat-tolerant athlete with a strong finishing kick.", hiddenAbility: 86 },
  { name: "Ines Novak", country: "Croatia", countryCode: "HR", gender: "F", age: 36, birthYear: 1990, ageCategory: "35-39", bio: "Steady athlete who handles long runnable sections well.", hiddenAbility: 89 },
  { name: "Omar Haddad", country: "Morocco", countryCode: "MA", gender: "M", age: 33, birthYear: 1993, ageCategory: "30-34", bio: "Fast starter with a good sense of pacing in dry conditions.", hiddenAbility: 87 },
  { name: "Nadia Petrova", country: "Bulgaria", countryCode: "BG", gender: "F", age: 42, birthYear: 1984, ageCategory: "40-44", bio: "Veteran ultrarunner known for consistent aid-station splits.", hiddenAbility: 85 },
  { name: "Henrik Larsen", country: "Norway", countryCode: "NO", gender: "M", age: 38, birthYear: 1988, ageCategory: "35-39", bio: "Cool-weather specialist with strong climbing form.", hiddenAbility: 92 },
  { name: "Priya Menon", country: "India", countryCode: "IN", gender: "F", age: 30, birthYear: 1996, ageCategory: "30-34", bio: "Durable runner who manages effort well over long efforts.", hiddenAbility: 90 },
  { name: "Javier Costa", country: "Portugal", countryCode: "PT", gender: "M", age: 35, birthYear: 1991, ageCategory: "35-39", bio: "Technical descender with a calm race rhythm.", hiddenAbility: 84 },
  { name: "Leila Mansour", country: "Tunisia", countryCode: "TN", gender: "F", age: 27, birthYear: 1999, ageCategory: "25-29", bio: "Quick on flatter runnable trails and exposed ridgelines.", hiddenAbility: 83 },
  { name: "Tariq Saleh", country: "Jordan", countryCode: "JO", gender: "M", age: 40, birthYear: 1986, ageCategory: "40-44", bio: "Experienced desert runner with a disciplined fueling plan.", hiddenAbility: 82 },
  { name: "Anika Rao", country: "New Zealand", countryCode: "NZ", gender: "F", age: 32, birthYear: 1994, ageCategory: "30-34", bio: "All-around mover who handles variable terrain with ease.", hiddenAbility: 95 },
  { name: "Bastian Frei", country: "Switzerland", countryCode: "CH", gender: "M", age: 39, birthYear: 1987, ageCategory: "35-39", bio: "Alpine runner with strong uphill economy.", hiddenAbility: 97 },
  { name: "Chloe Dubois", country: "France", countryCode: "FR", gender: "F", age: 26, birthYear: 2000, ageCategory: "25-29", bio: "Aggressive racer who can surprise on fast descents.", hiddenAbility: 81 },
  { name: "Petar Stojanovic", country: "Serbia", countryCode: "RS", gender: "M", age: 44, birthYear: 1982, ageCategory: "45-49", bio: "Strong in late race grind and long technical climbs.", hiddenAbility: 86 },
  { name: "Rina Sato", country: "Japan", countryCode: "JP", gender: "F", age: 29, birthYear: 1997, ageCategory: "25-29", bio: "Precise mountain racer with excellent cadence control.", hiddenAbility: 93 },
  { name: "Kwame Okoro", country: "Ghana", countryCode: "GH", gender: "M", age: 31, birthYear: 1995, ageCategory: "30-34", bio: "Explosive runner who often gains time on runnable sections.", hiddenAbility: 88 },
  { name: "Lucia Bianchi", country: "Italy", countryCode: "IT", gender: "F", age: 37, birthYear: 1989, ageCategory: "35-39", bio: "Mountain-mannered racer with reliable pacing and fueling.", hiddenAbility: 90 },
  { name: "Mateusz Kowalski", country: "Poland", countryCode: "PL", gender: "M", age: 34, birthYear: 1992, ageCategory: "30-34", bio: "Patient grinder who keeps moving in tough weather.", hiddenAbility: 84 },
  { name: "Sara Holm", country: "Sweden", countryCode: "SE", gender: "F", age: 28, birthYear: 1998, ageCategory: "25-29", bio: "Cool-climate athlete with strong mid-race consistency.", hiddenAbility: 87 },
  { name: "Diego Fernandez", country: "Chile", countryCode: "CL", gender: "M", age: 33, birthYear: 1993, ageCategory: "30-34", bio: "Mountain runner who handles long climbs and thin air well.", hiddenAbility: 91 },
  { name: "Ana Ribeiro", country: "Argentina", countryCode: "AR", gender: "F", age: 38, birthYear: 1988, ageCategory: "35-39", bio: "Tactical runner with reliable all-day endurance.", hiddenAbility: 85 },
  { name: "Noah Kim", country: "South Korea", countryCode: "KR", gender: "M", age: 30, birthYear: 1996, ageCategory: "30-34", bio: "Efficient mover with strong technical descents.", hiddenAbility: 89 },
  { name: "Hana Kolarova", country: "Czech Republic", countryCode: "CZ", gender: "F", age: 41, birthYear: 1985, ageCategory: "40-44", bio: "Veteran mountain racer with sharp race instincts.", hiddenAbility: 84 },
  { name: "Suleiman Ahmed", country: "Ethiopia", countryCode: "ET", gender: "M", age: 27, birthYear: 1999, ageCategory: "25-29", bio: "Smooth climber with a light stride over rough terrain.", hiddenAbility: 94 },
  { name: "Mina Hassan", country: "Egypt", countryCode: "EG", gender: "F", age: 35, birthYear: 1991, ageCategory: "35-39", bio: "Heat-adapted runner who stays measured in long efforts.", hiddenAbility: 82 },
  { name: "Jonas Eriksson", country: "Finland", countryCode: "FI", gender: "M", age: 43, birthYear: 1983, ageCategory: "40-44", bio: "Steady tempo runner with good durability in rough conditions.", hiddenAbility: 86 },
  { name: "Marta Nowak", country: "Poland", countryCode: "PL", gender: "F", age: 32, birthYear: 1994, ageCategory: "30-34", bio: "Balanced racer who rarely blows up late in a race.", hiddenAbility: 88 },
  { name: "Rafael Mendes", country: "Mexico", countryCode: "MX", gender: "M", age: 29, birthYear: 1997, ageCategory: "25-29", bio: "Fast on mixed surfaces with a strong closing surge.", hiddenAbility: 90 },
  { name: "Elena Varga", country: "Romania", countryCode: "RO", gender: "F", age: 40, birthYear: 1986, ageCategory: "40-44", bio: "Crafty mountain runner who keeps effort even.", hiddenAbility: 83 },
  { name: "Arman Demir", country: "Turkey", countryCode: "TR", gender: "M", age: 36, birthYear: 1990, ageCategory: "35-39", bio: "Strong on rolling courses and long runnable climbs.", hiddenAbility: 85 },
  { name: "Zara Khalil", country: "United Arab Emirates", countryCode: "AE", gender: "F", age: 31, birthYear: 1995, ageCategory: "30-34", bio: "Heat-management specialist who starts conservatively.", hiddenAbility: 81 },
  { name: "Samuel Tadesse", country: "Ethiopia", countryCode: "ET", gender: "M", age: 28, birthYear: 1998, ageCategory: "25-29", bio: "Ascender with excellent rhythm on long climbs.", hiddenAbility: 96 },
  { name: "Clara Meyer", country: "Austria", countryCode: "AT", gender: "F", age: 34, birthYear: 1992, ageCategory: "30-34", bio: "Technical mountain specialist with strong downhill control.", hiddenAbility: 89 },
  { name: "Julian Becker", country: "Netherlands", countryCode: "NL", gender: "M", age: 27, birthYear: 1999, ageCategory: "25-29", bio: "Fast, economical runner who does well on runnable course profiles.", hiddenAbility: 80 },
  { name: "Fatima El Idrissi", country: "Morocco", countryCode: "MA", gender: "F", age: 39, birthYear: 1987, ageCategory: "35-39", bio: "Smart pacer with a habit of overtaking late.", hiddenAbility: 87 },
  { name: "Leandro Costa", country: "Uruguay", countryCode: "UY", gender: "M", age: 42, birthYear: 1984, ageCategory: "40-44", bio: "Experienced ultrarunner with a smooth, controlled effort.", hiddenAbility: 82 },
  { name: "Ewa Zielinska", country: "Poland", countryCode: "PL", gender: "F", age: 33, birthYear: 1993, ageCategory: "30-34", bio: "Strong aerobic base and reliable negative splits.", hiddenAbility: 91 },
  { name: "Kaito Nakamura", country: "Japan", countryCode: "JP", gender: "M", age: 26, birthYear: 2000, ageCategory: "25-29", bio: "Young runner with sharp acceleration on open sections.", hiddenAbility: 88 },
  { name: "Helena Costa", country: "Portugal", countryCode: "PT", gender: "F", age: 45, birthYear: 1981, ageCategory: "45-49", bio: "Veteran racer who knows how to manage long mountain days.", hiddenAbility: 84 },
  { name: "David Okafor", country: "Nigeria", countryCode: "NG", gender: "M", age: 37, birthYear: 1989, ageCategory: "35-39", bio: "Durable runner with a strong threshold and good composure.", hiddenAbility: 85 },
  { name: "Nora Andersen", country: "Denmark", countryCode: "DK", gender: "F", age: 30, birthYear: 1996, ageCategory: "30-34", bio: "Efficient all-round runner who handles wind and rain well.", hiddenAbility: 86 },
  { name: "Tomasz Lewandowski", country: "Poland", countryCode: "PL", gender: "M", age: 41, birthYear: 1985, ageCategory: "40-44", bio: "Steady, no-nonsense athlete with good long-run stamina.", hiddenAbility: 83 },
  { name: "Malia Kealoha", country: "United States", countryCode: "US", gender: "F", age: 28, birthYear: 1998, ageCategory: "25-29", bio: "Ocean-to-mountain runner with strong leg speed.", hiddenAbility: 90 },
  { name: "Adrian Popescu", country: "Romania", countryCode: "RO", gender: "M", age: 35, birthYear: 1991, ageCategory: "35-39", bio: "Tough climber who stays composed when the pace rises.", hiddenAbility: 87 },
  { name: "Farah Al-Khatib", country: "Jordan", countryCode: "JO", gender: "F", age: 32, birthYear: 1994, ageCategory: "30-34", bio: "Measured competitor with strong endurance and discipline.", hiddenAbility: 82 },
  { name: "Ibrahim Rahman", country: "Bangladesh", countryCode: "BD", gender: "M", age: 38, birthYear: 1988, ageCategory: "35-39", bio: "Late-race grinder with a disciplined, even effort.", hiddenAbility: 83 },
];

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

function pickRaceIndices(runnerIndex: number): number[] {
  const offsets = [0, 2, 5, 8];
  return offsets.map((offset) => (runnerIndex + offset) % races.length);
}

/**
 * Generates realistic finish times and sorted positions for each race.
 * Does NOT compute points/ratings anymore — that's the real Elo
 * pipeline's job (see main(), which calls importFromPreview per race).
 */
function buildSeedResults(
  insertedRunners: Array<{ id: number; name: string }>,
  insertedRaces: Array<{ id: number; name: string }>,
): SeededResult[] {
  const raceByName = new Map(insertedRaces.map((race) => [race.name, race]));
  const raw: Array<Omit<SeededResult, "position">> = [];

  insertedRunners.forEach((runner, runnerIndex) => {
    const runnerSeed = runners[runnerIndex];
    const raceIndices = pickRaceIndices(runnerIndex);

    raceIndices.forEach((raceIndex) => {
      const sourceRace = races[raceIndex];
      const actualRace = raceByName.get(sourceRace.name)!;
      const baseTime = computeRaceBaseTime(sourceRace);
      const abilityWeight = abilityWeightForRace(sourceRace);
      const deterministicNoise = seededUnit(`${seedKey}|${runner.name}|${actualRace.name}`);
      const variationSeconds = Math.round((deterministicNoise - 0.5) * (Number(sourceRace.distanceKm) * 14));
      const finishTimeSeconds = Math.max(5400, Math.round(baseTime + (100 - runnerSeed.hiddenAbility) * abilityWeight + variationSeconds));

      raw.push({
        runnerId: runner.id,
        raceId: actualRace.id,
        finishTimeSeconds,
        dnf: false,
      });
    });
  });

  const byRaceId = new Map<number, typeof raw>();
  for (const result of raw) {
    const bucket = byRaceId.get(result.raceId) ?? [];
    bucket.push(result);
    byRaceId.set(result.raceId, bucket);
  }

  const ordered: SeededResult[] = [];
  for (const entries of byRaceId.values()) {
    const sorted = entries.slice().sort((left, right) => left.finishTimeSeconds - right.finishTimeSeconds);
    sorted.forEach((entry, index) => {
      ordered.push({ ...entry, position: index + 1 });
    });
  }

  return ordered;
}

async function main() {
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
      runners.map(({ hiddenAbility, ...runner }) => runner),
    ).returning();

    const insertedRaces = await tx.insert(racesTable).values(races).returning();

    return { insertedRunners, insertedRaces };
  });

  const results = buildSeedResults(insertedRunners, insertedRaces);
  const runnerById = new Map(insertedRunners.map((r) => [r.id, r]));

  const resultsByRaceId = new Map<number, SeededResult[]>();
  for (const result of results) {
    const bucket = resultsByRaceId.get(result.raceId) ?? [];
    bucket.push(result);
    resultsByRaceId.set(result.raceId, bucket);
  }

  // Process races in chronological order so ratings compound correctly
  // over the "season", exactly as they would with real scraped imports.
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