import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN!,
  },
  dialect: "turso",
  out: "./drizzle",
  schema: "./src/schema/index.ts",
});
