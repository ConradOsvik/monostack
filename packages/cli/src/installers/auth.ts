import path from "node:path";

import fs from "fs-extra";

import { addPackageDependency, updatePackageJson } from "../utils/deps.js";
import { copyTemplateDir } from "../utils/fs.js";
import type { InstallerContext } from "./index.js";

export function authInstaller(ctx: InstallerContext): void {
  const { projectDir, templateDir } = ctx;
  const extras = path.join(templateDir, "extras");

  // Copy auth package
  const authPkgDir = path.join(projectDir, "packages/auth");
  copyTemplateDir(path.join(extras, "auth"), authPkgDir);

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

  // Copy auth additions to native app
  if (fs.existsSync(path.join(extras, "auth-native"))) {
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

  // Add auth package as dependency to web, native, and api
  for (const target of ["apps/web", "apps/native", "packages/api"]) {
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
