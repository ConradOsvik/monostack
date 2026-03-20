import path from "node:path";

import { execa } from "execa";
import fs from "fs-extra";

import type { ProjectOptions } from "./constants.js";
import {
  MODULES,
  resolveModuleOrder,
  type InstallerContext,
} from "./modules/index.js";
import { applyTrpcVariantSync } from "./utils/autowire.js";
import { copyTemplateDir, interpolateDir } from "./utils/fs.js";
import { logger } from "./utils/logger.js";
import {
  installDependencies,
  type PackageManager,
} from "./utils/pkg-manager.js";

export async function scaffold(
  options: ProjectOptions,
  packageManager: PackageManager
): Promise<void> {
  const projectDir = path.resolve(process.cwd(), options.projectName);
  // Template dir is sibling to dist/ inside the CLI package
  const templateDir = path.join(import.meta.dirname, "..", "template");

  // Validate
  if (fs.existsSync(projectDir)) {
    logger.error(`Directory "${options.projectName}" already exists.`);
    process.exit(1);
  }

  fs.ensureDirSync(projectDir);

  const ctx: InstallerContext = { options, projectDir, templateDir };

  // 1. Copy base template
  copyTemplateDir(path.join(templateDir, "base"), projectDir);
  logger.success("Copied base template");

  // 2. Copy web app
  copyTemplateDir(
    path.join(templateDir, "apps/web"),
    path.join(projectDir, "apps/web")
  );
  logger.success("Set up web app (TanStack Start + Tailwind + shadcn)");

  // 3. Copy core packages
  copyTemplateDir(
    path.join(templateDir, "packages/config"),
    path.join(projectDir, "packages/config")
  );
  logger.success("Added config package");

  copyTemplateDir(
    path.join(templateDir, "packages/env"),
    path.join(projectDir, "packages/env")
  );
  logger.success("Added env package (t3-env)");

  copyTemplateDir(
    path.join(templateDir, "packages/api"),
    path.join(projectDir, "packages/api")
  );
  logger.success("Added API package (tRPC)");

  // 4. Run module installers in dependency order
  const orderedModules = resolveModuleOrder(options.modules);
  for (const moduleName of orderedModules) {
    const mod = MODULES[moduleName];
    mod.install(ctx);
    logger.success(`Added ${mod.label}`);
  }

  // 5. Apply the correct trpc.ts variant based on all selected modules
  applyTrpcVariantSync(projectDir, templateDir, options.modules);

  // 6. Interpolate all template variables
  interpolateDir(projectDir, {
    projectName: options.projectName,
  });

  // 7. Format all files
  try {
    await execa("npx", ["oxfmt", "--write", "."], {
      cwd: projectDir,
      stdio: "pipe",
    });
  } catch {
    // oxfmt not available — skip formatting
  }

  // 8. Install dependencies
  if (options.install) {
    const oraModule = await import("ora");
    const ora = oraModule.default;
    const spinner = ora("Installing dependencies...").start();
    try {
      await installDependencies(projectDir, packageManager);
      spinner.succeed("Installed dependencies");
    } catch {
      spinner.fail("Failed to install dependencies");
      logger.warn("You can install dependencies manually later.");
    }
  }

  // 9. Git init
  if (options.git) {
    try {
      await execa("git", ["init"], { cwd: projectDir });
      await execa("git", ["add", "-A"], { cwd: projectDir });
      await execa("git", ["commit", "-m", "initial commit"], {
        cwd: projectDir,
      });
      logger.success("Initialized git repository");
    } catch {
      logger.warn("Failed to initialize git repository.");
    }
  }
}
