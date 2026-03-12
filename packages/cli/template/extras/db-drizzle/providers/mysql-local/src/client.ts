import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Note: For MySQL, use mysql2 driver instead
const client = postgres(process.env.DATABASE_URL!);

export const db = drizzle({ client, schema });
