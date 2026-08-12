import { pgTable, serial, integer, numeric, boolean, timestamp, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { runnersTable } from "./runners";
import { racesTable } from "./races";

export const resultsTable = pgTable("results", {
  id: serial("id").primaryKey(),
  runnerId: integer("runner_id").notNull().references(() => runnersTable.id, { onDelete: "cascade" }),
  raceId: integer("race_id").notNull().references(() => racesTable.id, { onDelete: "cascade" }),
  position: integer("position"),
  finishTimeSeconds: integer("finish_time_seconds"),
  dnf: boolean("dnf").notNull().default(false),
  points: numeric("points", { precision: 8, scale: 2 }).notNull().default("0"),
  ratingAfter: numeric("rating_after", { precision: 10, scale: 3 }),
  source: text("source"),
  sourceResultId: text("source_result_id"),
  sourceRegistrationId: text("source_registration_id"),
  sourceModifiedAt: timestamp("source_modified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("results_runner_race_unique").on(table.runnerId, table.raceId),
  uniqueIndex("results_source_result_unique").on(table.source, table.sourceResultId),
]);

export const insertResultSchema = createInsertSchema(resultsTable).omit({ id: true, createdAt: true });
export type InsertResult = z.infer<typeof insertResultSchema>;
export type Result = typeof resultsTable.$inferSelect;
