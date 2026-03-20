import path from "node:path";

import fs from "fs-extra";

import { addEnvVars, addEnvExampleVars } from "../utils/autowire.js";
import { addPackageDependency, updatePackageJson } from "../utils/deps.js";
import { copyTemplateDir } from "../utils/fs.js";
import type {
  AddContext,
  InstallerContext,
  ModuleDefinition,
} from "./index.js";

export const mailModule: ModuleDefinition = {
  name: "mail",
  label: "Email (React Email + Resend)",
  dependencies: [],

  detect(projectDir: string): boolean {
    return fs.existsSync(path.join(projectDir, "packages/mail/package.json"));
  },

  install(ctx: InstallerContext): void {
    mailInstaller(ctx);
  },

  async add(ctx: AddContext): Promise<void> {
    mailInstaller(ctx);
  },
};

function mailInstaller(ctx: InstallerContext): void {
  const { projectDir, templateDir } = ctx;
  const extras = path.join(templateDir, "extras");

  // Copy mail package
  const mailPkgDir = path.join(projectDir, "packages/mail");
  copyTemplateDir(path.join(extras, "mail"), mailPkgDir);

  // Add dependencies
  addPackageDependency(path.join(mailPkgDir, "package.json"), {
    dependencies: ["resend", "@react-email/components"],
    devDependencies: ["react-email"],
  });

  // Add mail package as dependency to api package
  const apiPkgJson = path.join(projectDir, "packages/api/package.json");
  if (fs.existsSync(apiPkgJson)) {
    updatePackageJson(apiPkgJson, (pkg) => {
      if (!pkg.dependencies) {
        pkg.dependencies = {};
      }
      (pkg.dependencies as Record<string, string>)[`@{{projectName}}/mail`] =
        "workspace:*";
    });
  }

  // Add RESEND_API_KEY to env server.ts
  const serverEnvPath = path.join(projectDir, "packages/env/src/server.ts");
  if (fs.existsSync(serverEnvPath)) {
    addEnvVars(serverEnvPath, {
      RESEND_API_KEY: "z.string().min(1)",
    });
  }

  // Add to .env.example
  const envExamplePath = path.join(projectDir, ".env.example");
  if (fs.existsSync(envExamplePath)) {
    addEnvExampleVars(envExamplePath, ["RESEND_API_KEY="]);
  }
}
