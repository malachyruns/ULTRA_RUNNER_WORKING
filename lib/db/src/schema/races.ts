import { pgTable, serial, text, integer, numeric, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizersTable } from "./organizers";

export const racesTable = pgTable("races", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  country: text("country").notNull(),
  countryCode: text("country_code"),
  date: text("date").notNull(),
  distanceKm: numeric("distance_km", { precision: 8, scale: 2 }).notNull(),
  distanceLabel: text("distance_label"),
  category: text("category").notNull(),
  surface: text("surface").notNull().default("trail"),
  totalElevationM: integer("total_elevation_m"),
  description: text("description"),
  status: text("status").notNull().default("upcoming"),
  finishersCount: integer("finishers_count"),
  weatherConditions: text("weather_conditions"),
  technicalityRating: integer("technicality_rating"),
  difficultyScore: numeric("difficulty_score", { precision: 6, scale: 3 }).notNull().default("1.000"),
  organizerId: integer("organizer_id").references(() => organizersTable.id, { onDelete: "set null" }),
  source: text("source"),
  sourceRaceId: text("source_race_id"),
  sourceEventId: text("source_event_id"),
  sourceUrl: text("source_url").unique(),
  sourceModifiedAt: timestamp("source_modified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("races_source_event_unique").on(table.source, table.sourceRaceId, table.sourceEventId),
]);

export const insertRaceSchema = createInsertSchema(racesTable).omit({ id: true, createdAt: true });
export type InsertRace = z.infer<typeof insertRaceSchema>;
export type Race = typeof racesTable.$inferSelect;
