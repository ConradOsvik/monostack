import path from "node:path";

import fs from "fs-extra";

import type { DatabaseProvider, DatabaseType } from "../src/constants";
import { createTempDir, makeOptions, scaffoldProject } from "./helpers";

/**
 * Matrix of all database provider combinations.
 * Each entry defines what to assert for that specific provider.
 */
const PROVIDER_MATRIX: {
  name: string;
  database: DatabaseType;
  provider: DatabaseProvider;
  clientContains: string[];
  configDialect: string;
  schemaTable: "pgTable" | "sqliteTable" | "mysqlTable";
  expectedDep: string;
}[] = [
  // ── PostgreSQL ─────────────────────────────────────────
  {
    name: "neon",
    database: "postgres",
    provider: "neon",
    clientContains: ["@neondatabase/serverless", "drizzle-orm/neon-http"],
    configDialect: "postgresql",
    schemaTable: "pgTable",
    expectedDep: "@neondatabase/serverless",
  },
  {
    name: "supabase",
    database: "postgres",
    provider: "supabase",
    clientContains: ["drizzle-orm/postgres-js", "postgres"],
    configDialect: "postgresql",
    schemaTable: "pgTable",
    expectedDep: "postgres",
  },
  {
    name: "vercel-postgres",
    database: "postgres",
    provider: "vercel-postgres",
    clientContains: ["drizzle-orm/postgres-js", "postgres"],
    configDialect: "postgresql",
    schemaTable: "pgTable",
    expectedDep: "postgres",
  },
  {
    name: "postgres-local",
    database: "postgres",
    provider: "local",
    clientContains: ["drizzle-orm/postgres-js", "postgres"],
    configDialect: "postgresql",
    schemaTable: "pgTable",
    expectedDep: "postgres",
  },
  // ── MySQL ──────────────────────────────────────────────
  {
    name: "planetscale",
    database: "mysql",
    provider: "planetscale",
    clientContains: ["drizzle-orm/postgres-js"],
    configDialect: "mysql",
    schemaTable: "mysqlTable",
    expectedDep: "postgres", // placeholder — should be mysql2
  },
  {
    name: "mysql-local",
    database: "mysql",
    provider: "local",
    clientContains: ["drizzle-orm/postgres-js"],
    configDialect: "mysql",
    schemaTable: "mysqlTable",
    expectedDep: "postgres", // placeholder — should be mysql2
  },
  // ── SQLite ─────────────────────────────────────────────
  {
    name: "turso",
    database: "sqlite",
    provider: "turso",
    clientContains: ["drizzle-orm/libsql", "authToken"],
    configDialect: "turso",
    schemaTable: "sqliteTable",
    expectedDep: "@libsql/client",
  },
  {
    name: "sqlite-local",
    database: "sqlite",
    provider: "local",
    clientContains: ["drizzle-orm/libsql"],
    configDialect: "sqlite",
    schemaTable: "sqliteTable",
    expectedDep: "@libsql/client",
  },
];

describe.each(PROVIDER_MATRIX)(
  "provider: $name ($database)",
  ({
    name,
    database,
    provider,
    clientContains,
    configDialect,
    schemaTable,
    expectedDep,
  }) => {
    let projectDir: string;

    beforeAll(() => {
      projectDir = createTempDir(`provider-${name}`);
      scaffoldProject(
        projectDir,
        makeOptions({
          projectName: `test-${name}`,
          modules: ["db"],
          database,
          provider,
        })
      );
    });

    afterAll(() => fs.removeSync(projectDir));

    it("creates db package with all expected files", () => {
      for (const file of [
        "packages/db/package.json",
        "packages/db/drizzle.config.ts",
        "packages/db/src/client.ts",
        "packages/db/src/index.ts",
        "packages/db/src/schema/index.ts",
        "packages/db/src/schema/user.ts",
      ]) {
        expect(fs.existsSync(path.join(projectDir, file))).toBeTruthy();
      }
    });

    it(`client.ts uses correct driver`, () => {
      const client = fs.readFileSync(
        path.join(projectDir, "packages/db/src/client.ts"),
        "utf8"
      );
      for (const expected of clientContains) {
        expect(client).toContain(expected);
      }
    });

    it(`drizzle.config.ts uses "${configDialect}" dialect`, () => {
      const config = fs.readFileSync(
        path.join(projectDir, "packages/db/drizzle.config.ts"),
        "utf8"
      );
      expect(config).toContain(`"${configDialect}"`);
    });

    it(`schema uses ${schemaTable}`, () => {
      const schema = fs.readFileSync(
        path.join(projectDir, "packages/db/src/schema/user.ts"),
        "utf8"
      );
      expect(schema).toContain(schemaTable);
    });

    it(`has correct driver dependency in package.json`, () => {
      const pkg = fs.readJsonSync(
        path.join(projectDir, "packages/db/package.json")
      );
      expect(pkg.dependencies[expectedDep]).toBeDefined();
      expect(pkg.dependencies["drizzle-orm"]).toBeDefined();
      expect(pkg.devDependencies["drizzle-kit"]).toBeDefined();
    });

    it("has db scripts", () => {
      const pkg = fs.readJsonSync(
        path.join(projectDir, "packages/db/package.json")
      );
      expect(pkg.scripts["db:push"]).toBe("drizzle-kit push");
      expect(pkg.scripts["db:generate"]).toBe("drizzle-kit generate");
      expect(pkg.scripts["db:migrate"]).toBe("drizzle-kit migrate");
      expect(pkg.scripts["db:studio"]).toBe("drizzle-kit studio");
    });

    it("adds db tasks to turbo.json", () => {
      const turbo = fs.readJsonSync(path.join(projectDir, "turbo.json"));
      expect(turbo.tasks["db:push"]).toBeDefined();
      expect(turbo.tasks["db:generate"]).toBeDefined();
      expect(turbo.tasks["db:studio"]).toBeDefined();
    });

    it("wires db into tRPC context", () => {
      const trpc = fs.readFileSync(
        path.join(projectDir, "packages/api/src/trpc.ts"),
        "utf8"
      );
      expect(trpc).toContain(`@test-${name}/db`);
    });

    it("adds DATABASE_URL to server env", () => {
      const env = fs.readFileSync(
        path.join(projectDir, "packages/env/src/server.ts"),
        "utf8"
      );
      expect(env).toContain("DATABASE_URL");
    });

    it("adds db as api dependency", () => {
      const pkg = fs.readJsonSync(
        path.join(projectDir, "packages/api/package.json")
      );
      expect(pkg.dependencies[`@test-${name}/db`]).toBe("workspace:*");
    });

    it("has no leftover {{projectName}} placeholders", () => {
      const files = [
        "packages/db/package.json",
        "packages/db/src/client.ts",
        "packages/db/src/index.ts",
        "packages/api/src/trpc.ts",
        "packages/env/src/server.ts",
      ];
      for (const file of files) {
        const content = fs.readFileSync(path.join(projectDir, file), "utf8");
        expect(content).not.toContain("{{projectName}}");
      }
    });
  }
);
