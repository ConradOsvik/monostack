import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  email: text("email").notNull().unique(),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
