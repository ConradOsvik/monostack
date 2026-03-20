import path from "node:path";

import fs from "fs-extra";

import type { DatabaseType } from "../constants.js";
import { applyTrpcVariant } from "../utils/autowire.js";
import { addPackageDependency, updatePackageJson } from "../utils/deps.js";
import { copyTemplateDir, interpolateFile } from "../utils/fs.js";
import type {
  AddContext,
  InstallerContext,
  ModuleDefinition,
} from "./index.js";

export const authModule: ModuleDefinition = {
  name: "auth",
  label: "Authentication (Better Auth)",
  dependencies: ["db"],

  detect(projectDir: string): boolean {
    return fs.existsSync(path.join(projectDir, "packages/auth/package.json"));
  },

  install(ctx: InstallerContext): void {
    authInstaller(ctx);
  },

  async add(ctx: AddContext): Promise<void> {
    authInstaller(ctx);
    await applyTrpcVariant(ctx);
  },
};

function authInstaller(ctx: InstallerContext): void {
  const { projectDir, templateDir, options } = ctx;
  const extras = path.join(templateDir, "extras");

  // Copy auth package
  const authPkgDir = path.join(projectDir, "packages/auth");
  copyTemplateDir(path.join(extras, "auth"), authPkgDir);

  // Interpolate the drizzle adapter provider based on database type
  const dbProvider = getDbProvider(options.database);
  interpolateFile(path.join(authPkgDir, "src/index.ts"), { dbProvider });

  // Add better-auth dependency
  addPackageDependency(path.join(authPkgDir, "package.json"), {
    dependencies: ["better-auth"],
  });

  // Copy auth additions to web app
  if (fs.existsSync(path.join(extras, "auth-web"))) {
    copyTemplateDir(
      path.join(extras, "auth-web"),
      path.join(projectDir, "apps/web")
    );
  }

  // Copy auth additions to native app (only if native is installed/being installed)
  const hasNative =
    options.modules.includes("native") ||
    fs.existsSync(path.join(projectDir, "apps/native/package.json"));
  if (hasNative && fs.existsSync(path.join(extras, "auth-native"))) {
    copyTemplateDir(
      path.join(extras, "auth-native"),
      path.join(projectDir, "apps/native")
    );
  }

  // Copy auth additions to API package
  if (fs.existsSync(path.join(extras, "auth-api"))) {
    copyTemplateDir(
      path.join(extras, "auth-api"),
      path.join(projectDir, "packages/api")
    );
  }

  // Add auth package as dependency to web and api
  const targets = ["apps/web", "packages/api"];
  // Also add to native if it exists
  if (hasNative) {
    targets.push("apps/native");
  }

  for (const target of targets) {
    const pkgJsonPath = path.join(projectDir, target, "package.json");
    if (fs.existsSync(pkgJsonPath)) {
      updatePackageJson(pkgJsonPath, (pkg) => {
        if (!pkg.dependencies) {
          pkg.dependencies = {};
        }
        (pkg.dependencies as Record<string, string>)[`@{{projectName}}/auth`] =
          "workspace:*";
      });
    }
  }
}

function getDbProvider(database: DatabaseType | null): string {
  switch (database) {
    case "postgres":
      return "pg";
    case "mysql":
      return "mysql";
    case "sqlite":
    default:
      return "sqlite";
  }
}
