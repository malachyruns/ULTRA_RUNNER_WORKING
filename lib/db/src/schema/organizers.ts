import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const organizersTable = pgTable("organizers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  organizationName: text("organization_name").notNull(),
  website: text("website"),
  isVerified: boolean("is_verified").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrganizerSchema = createInsertSchema(organizersTable).omit({ id: true, createdAt: true });
export type InsertOrganizer = z.infer<typeof insertOrganizerSchema>;
export type Organizer = typeof organizersTable.$inferSelect;
