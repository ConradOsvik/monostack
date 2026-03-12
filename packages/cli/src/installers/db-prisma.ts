import path from "node:path";

import fs from "fs-extra";

import type { DatabaseProvider, DatabaseType } from "../constants.js";
import {
  addPackageDependency,
  updatePackageJson,
  mergeJsonFile,
} from "../utils/deps.js";
import { copyTemplateDir } from "../utils/fs.js";
import type { InstallerContext } from "./index.js";

export function dbPrismaInstaller(ctx: InstallerContext): void {
  const { projectDir, templateDir, options } = ctx;
  const dbPkgDir = path.join(projectDir, "packages/db");
  const extras = path.join(templateDir, "extras");

  // Copy base prisma files
  copyTemplateDir(path.join(extras, "db-prisma/base"), dbPkgDir);

  // Copy provider-specific files
  const providerDir = getProviderDir(options.database!, options.provider!);
  if (fs.existsSync(path.join(extras, `db-prisma/providers/${providerDir}`))) {
    copyTemplateDir(
      path.join(extras, `db-prisma/providers/${providerDir}`),
      dbPkgDir
    );
  }

  // Add dependencies to db package.json
  const dbPkgJson = path.join(dbPkgDir, "package.json");
  addPackageDependency(dbPkgJson, {
    dependencies: getPrismaDeps(options.provider!),
    devDependencies: ["prisma"],
  });

  // Add db scripts
  updatePackageJson(dbPkgJson, (pkg) => {
    pkg.scripts = {
      ...(pkg.scripts as Record<string, string> | undefined),
      "db:generate": "prisma generate",
      "db:migrate": "prisma migrate dev",
      "db:push": "prisma db push",
      "db:studio": "prisma studio",
    };
  });

  // Copy db-api extras (adds db context to tRPC)
  if (fs.existsSync(path.join(extras, "db-api"))) {
    copyTemplateDir(
      path.join(extras, "db-api"),
      path.join(projectDir, "packages/api")
    );
  }

  // Copy db-web extras (env additions)
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

  // Add tasks to turbo.json
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

function getPrismaDeps(
  provider: DatabaseProvider
): (keyof typeof import("../constants.js").DEPENDENCY_VERSIONS)[] {
  const deps: (keyof typeof import("../constants.js").DEPENDENCY_VERSIONS)[] = [
    "@prisma/client",
  ];

  switch (provider) {
    case "neon": {
      deps.push("@neondatabase/serverless", "@prisma/adapter-neon");
      break;
    }
    case "turso": {
      deps.push("@libsql/client", "@prisma/adapter-libsql");
      break;
    }
  }

  return deps;
}
