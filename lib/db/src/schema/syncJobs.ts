import { pgTable, serial, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { organizersTable } from "./organizers";

export const syncJobsTable = pgTable("sync_jobs", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  organizerId: integer("organizer_id").references(() => organizersTable.id, { onDelete: "set null" }),
  mode: text("mode").notNull(),
  status: text("status").notNull().default("pending"),
  requestedIdentifier: text("requested_identifier"),
  discoveryPage: integer("discovery_page").notNull().default(1),
  currentRaceId: text("current_race_id"),
  currentEventId: text("current_event_id"),
  resultPage: integer("result_page").notNull().default(1),
  checkpointTimestamp: integer("checkpoint_timestamp"),
  summary: jsonb("summary").notNull().default({}),
  warnings: jsonb("warnings").notNull().default([]),
  error: text("error"),
  pauseRequestedAt: timestamp("pause_requested_at"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("sync_jobs_source_status_idx").on(table.source, table.status)]);

export type SyncJob = typeof syncJobsTable.$inferSelect;
