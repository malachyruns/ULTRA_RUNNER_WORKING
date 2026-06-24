import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const racesTable = pgTable("races", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  country: text("country").notNull(),
  countryCode: text("country_code"),
  date: text("date").notNull(),
  distanceKm: numeric("distance_km", { precision: 8, scale: 2 }).notNull(),
  category: text("category").notNull(),
  surface: text("surface").notNull().default("trail"),
  totalElevationM: integer("total_elevation_m"),
  description: text("description"),
  status: text("status").notNull().default("upcoming"),
  finishersCount: integer("finishers_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRaceSchema = createInsertSchema(racesTable).omit({ id: true, createdAt: true });
export type InsertRace = z.infer<typeof insertRaceSchema>;
export type Race = typeof racesTable.$inferSelect;
