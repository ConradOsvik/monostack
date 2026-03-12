import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

export const db = drizzle({
  connection: {
    authToken: process.env.DATABASE_AUTH_TOKEN!,
    url: process.env.DATABASE_URL!,
  },
  schema,
});
