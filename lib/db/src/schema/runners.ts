import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const runnersTable = pgTable("runners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  countryCode: text("country_code"),
  gender: text("gender").notNull().default("M"),
  age: integer("age"),
  birthYear: integer("birth_year"),
  ageCategory: text("age_category"),
  bio: text("bio"),
  enduranceLevel: numeric("endurance_level", { precision: 8, scale: 2 }),
  rating: numeric("rating", { precision: 8, scale: 2 }).notNull().default("1000"),
  rank: integer("rank").notNull().default(0),
  totalRaces: integer("total_races").notNull().default(0),
  totalDistanceKm: numeric("total_distance_km", { precision: 10, scale: 2 }).notNull().default("0"),
  bestFinish: integer("best_finish"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRunnerSchema = createInsertSchema(runnersTable).omit({ id: true, createdAt: true });
export type InsertRunner = z.infer<typeof insertRunnerSchema>;
export type Runner = typeof runnersTable.$inferSelect;
