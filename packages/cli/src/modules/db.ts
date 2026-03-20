import path from "node:path";

import fs from "fs-extra";

import type { DatabaseProvider, DatabaseType } from "../constants.js";
import { applyTrpcVariant } from "../utils/autowire.js";
import {
  addPackageDependency,
  updatePackageJson,
  mergeJsonFile,
} from "../utils/deps.js";
import { copyTemplateDir } from "../utils/fs.js";
import type {
  AddContext,
  InstallerContext,
  ModuleDefinition,
} from "./index.js";

export const dbModule: ModuleDefinition = {
  name: "db",
  label: "Database (Drizzle)",
  dependencies: [],

  detect(projectDir: string): boolean {
    return fs.existsSync(path.join(projectDir, "packages/db/package.json"));
  },

  install(ctx: InstallerContext): void {
    dbInstaller(ctx);
  },

  async add(ctx: AddContext): Promise<void> {
    dbInstaller(ctx);
    await applyTrpcVariant(ctx);
  },
};

function dbInstaller(ctx: InstallerContext): void {
  const { projectDir, templateDir, options } = ctx;
  const dbPkgDir = path.join(projectDir, "packages/db");
  const extras = path.join(templateDir, "extras");

  // Copy base drizzle files
  copyTemplateDir(path.join(extras, "db-drizzle/base"), dbPkgDir);

  // Copy provider-specific files (overrides/additions)
  const providerDir = getProviderDir(options.database!, options.provider!);
  if (fs.existsSync(path.join(extras, `db-drizzle/providers/${providerDir}`))) {
    copyTemplateDir(
      path.join(extras, `db-drizzle/providers/${providerDir}`),
      dbPkgDir
    );
  }

  // Add dependencies to db package.json
  const dbPkgJson = path.join(dbPkgDir, "package.json");
  addPackageDependency(dbPkgJson, {
    dependencies: getDrizzleDeps(options.database!, options.provider!),
    devDependencies: ["drizzle-kit"],
  });

  // Add db scripts to db package.json
  updatePackageJson(dbPkgJson, (pkg) => {
    pkg.scripts = {
      ...(pkg.scripts as Record<string, string> | undefined),
      "db:generate": "drizzle-kit generate",
      "db:migrate": "drizzle-kit migrate",
      "db:push": "drizzle-kit push",
      "db:studio": "drizzle-kit studio",
    };
  });

  // Copy db-api extras (adds db context to tRPC)
  if (fs.existsSync(path.join(extras, "db-api"))) {
    copyTemplateDir(
      path.join(extras, "db-api"),
      path.join(projectDir, "packages/api")
    );
  }

  // Copy db-web extras (env additions for web)
  if (fs.existsSync(path.join(extras, "db-web"))) {
    copyTemplateDir(
      path.join(extras, "db-web"),
      path.join(projectDir, "packages/env")
    );
  }

  // Add db package as dependency to api package
  const apiPkgJson = path.join(projectDir, "packages/api/package.json");
  if (fs.existsSync(apiPkgJson)) {
    updatePackageJson(apiPkgJson, (pkg) => {
      if (!pkg.dependencies) {
        pkg.dependencies = {};
      }
      (pkg.dependencies as Record<string, string>)[`@{{projectName}}/db`] =
        "workspace:*";
    });
  }

  // Add db:push and db:generate to turbo.json
  const turboJsonPath = path.join(projectDir, "turbo.json");
  if (fs.existsSync(turboJsonPath)) {
    mergeJsonFile(turboJsonPath, {
      tasks: {
        "db:generate": {},
        "db:migrate": { cache: false },
        "db:push": { cache: false },
        "db:studio": { persistent: true, cache: false },
      },
    });
  }
}

function getProviderDir(db: DatabaseType, provider: DatabaseProvider): string {
  if (provider === "local") {
    return `${db}-local`;
  }
  return provider;
}

function getDrizzleDeps(
  db: DatabaseType,
  provider: DatabaseProvider
): (keyof typeof import("../constants.js").DEPENDENCY_VERSIONS)[] {
  const deps: (keyof typeof import("../constants.js").DEPENDENCY_VERSIONS)[] = [
    "drizzle-orm",
  ];

  switch (provider) {
    case "neon": {
      deps.push("@neondatabase/serverless");
      break;
    }
    case "supabase":
    case "vercel-postgres":
    case "local": {
      if (db === "postgres") {
        deps.push("postgres");
      }
      if (db === "mysql") {
        deps.push("postgres");
      } // mysql2 would be needed - using postgres as placeholder
      if (db === "sqlite") {
        deps.push("@libsql/client");
      }
      break;
    }
    case "turso": {
      deps.push("@libsql/client");
      break;
    }
    case "planetscale": {
      deps.push("postgres"); // mysql2 would be needed
      break;
    }
  }

  return deps;
}
