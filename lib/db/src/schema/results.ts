import { pgTable, serial, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertResultSchema = createInsertSchema(resultsTable).omit({ id: true, createdAt: true });
export type InsertResult = z.infer<typeof insertResultSchema>;
export type Result = typeof resultsTable.$inferSelect;
