import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const libsql = createClient({
    authToken: process.env.DATABASE_AUTH_TOKEN,
    url: process.env.DATABASE_URL!,
  });
  const adapter = new PrismaLibSQL(libsql);
  return new PrismaClient({ adapter } as any);
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
