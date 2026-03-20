import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

import fs from "fs-extra";

import type { ModuleName, ProjectOptions } from "../src/constants";
import type { InstallerContext } from "../src/modules";
import { MODULES, resolveModuleOrder } from "../src/modules";
import { applyTrpcVariantSync } from "../src/utils/autowire";
import { copyTemplateDir, interpolateDir } from "../src/utils/fs";

export const TEMPLATE_DIR = path.join(import.meta.dirname, "..", "template");

/** Create a unique temp directory for each test */
export function createTempDir(testName: string): string {
  const dir = path.join(
    os.tmpdir(),
    `monostack-test-${testName}-${Date.now()}`
  );
  fs.ensureDirSync(dir);
  return dir;
}

/** Run the core scaffold logic (without install/git) */
export function scaffoldProject(
  projectDir: string,
  options: ProjectOptions
): void {
  const ctx: InstallerContext = {
    options,
    projectDir,
    templateDir: TEMPLATE_DIR,
  };

  // Base
  copyTemplateDir(path.join(TEMPLATE_DIR, "base"), projectDir);

  // Web app
  copyTemplateDir(
    path.join(TEMPLATE_DIR, "apps/web"),
    path.join(projectDir, "apps/web")
  );

  // Core packages
  copyTemplateDir(
    path.join(TEMPLATE_DIR, "packages/config"),
    path.join(projectDir, "packages/config")
  );
  copyTemplateDir(
    path.join(TEMPLATE_DIR, "packages/env"),
    path.join(projectDir, "packages/env")
  );
  copyTemplateDir(
    path.join(TEMPLATE_DIR, "packages/api"),
    path.join(projectDir, "packages/api")
  );

  // Module installers in dependency order
  const orderedModules = resolveModuleOrder(options.modules);
  for (const moduleName of orderedModules) {
    MODULES[moduleName].install(ctx);
  }

  // Apply correct trpc.ts variant
  applyTrpcVariantSync(projectDir, TEMPLATE_DIR, options.modules);

  // Interpolate
  interpolateDir(projectDir, { projectName: options.projectName });

  // Format output
  try {
    execSync("npx oxfmt --write .", { cwd: projectDir, stdio: "pipe" });
  } catch {
    // oxfmt not available
  }
}

/** Default options for scaffolding — override what you need */
export function makeOptions(
  overrides: Partial<ProjectOptions> & { projectName: string }
): ProjectOptions {
  return {
    database: null,
    git: false,
    install: false,
    modules: [],
    provider: null,
    ...overrides,
  };
}

/** Recursively collect all file paths in a directory */
export function getAllFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git") {
        files.push(...getAllFiles(full));
      }
    } else {
      files.push(full);
    }
  }
  return files;
}
