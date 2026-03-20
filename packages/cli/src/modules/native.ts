import path from "node:path";

import fs from "fs-extra";

import { addPackageDependency, updatePackageJson } from "../utils/deps.js";
import { copyTemplateDir } from "../utils/fs.js";
import type {
  AddContext,
  InstallerContext,
  ModuleDefinition,
} from "./index.js";

export const nativeModule: ModuleDefinition = {
  name: "native",
  label: "Native App (Expo + React Native)",
  dependencies: [],

  detect(projectDir: string): boolean {
    return fs.existsSync(path.join(projectDir, "apps/native/package.json"));
  },

  install(ctx: InstallerContext): void {
    nativeInstaller(ctx);
  },

  async add(ctx: AddContext): Promise<void> {
    nativeInstaller(ctx);
  },
};

function nativeInstaller(ctx: InstallerContext): void {
  const { projectDir, templateDir, options } = ctx;
  const extras = path.join(templateDir, "extras");

  // Copy native app template
  copyTemplateDir(
    path.join(templateDir, "apps/native"),
    path.join(projectDir, "apps/native")
  );

  // If auth is installed/being installed, copy auth-native extras
  const hasAuth =
    options.modules.includes("auth") ||
    fs.existsSync(path.join(projectDir, "packages/auth/package.json"));
  if (hasAuth && fs.existsSync(path.join(extras, "auth-native"))) {
    copyTemplateDir(
      path.join(extras, "auth-native"),
      path.join(projectDir, "apps/native")
    );

    // Add auth + better-auth as dependencies to native app
    const nativePkgJson = path.join(projectDir, "apps/native/package.json");
    if (fs.existsSync(nativePkgJson)) {
      addPackageDependency(nativePkgJson, {
        dependencies: ["better-auth"],
      });
      updatePackageJson(nativePkgJson, (pkg) => {
        if (!pkg.dependencies) {
          pkg.dependencies = {};
        }
        (pkg.dependencies as Record<string, string>)[`@{{projectName}}/auth`] =
          "workspace:*";
      });
    }
  }
}
