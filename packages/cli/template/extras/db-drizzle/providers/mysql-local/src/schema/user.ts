import { mysqlTable, varchar, timestamp } from "drizzle-orm/mysql-core";

export const user = mysqlTable("user", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
