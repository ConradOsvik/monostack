import * as p from "@clack/prompts";
import { Command } from "commander";
import { execa } from "execa";
import pc from "picocolors";

import type {
  DatabaseProvider,
  DatabaseType,
  ModuleName,
} from "./constants.js";
import {
  MODULES,
  detectInstalledModules,
  resolveModuleOrder,
} from "./modules/index.js";
import { runAddPrompts } from "./prompts-add.js";
import { runPrompts } from "./prompts.js";
import { scaffold } from "./scaffold.js";
import { findProjectRoot, readProjectName } from "./utils/autowire.js";
import { interpolateDir } from "./utils/fs.js";
import { logger } from "./utils/logger.js";
import {
  detectPackageManager,
  getRunCommand,
  installDependencies,
} from "./utils/pkg-manager.js";

const program = new Command();

program
  .name("monostack")
  .description("Scaffold and manage opinionated fullstack monorepos")
  .version("0.1.0");

// ─── create command ─────────────────────────────────────────

const createCmd = program
  .command("create")
  .description("Create a new Monostack project")
  .argument("[project-name]", "Name of the project")
  .option("--db", "Include database module")
  .option("--auth", "Include authentication module")
  .option("--native", "Include native app module")
  .option("--mail", "Include mail module")
  .option("--db-type <type>", "Database type (postgres, mysql, sqlite)")
  .option(
    "--provider <provider>",
    "Database provider (neon, supabase, turso, etc.)"
  )
  .option("--git", "Initialize git repository", true)
  .option("--no-git", "Skip git initialization")
  .option("--install", "Install dependencies", true)
  .option("--no-install", "Skip dependency installation")
  .action(async (projectNameArg: string | undefined, opts) => {
    const pm = detectPackageManager();

    // Build modules list from flags
    const flagModules: ModuleName[] = [];
    if (opts.db) flagModules.push("db");
    if (opts.auth) flagModules.push("auth");
    if (opts.native) flagModules.push("native");
    if (opts.mail) flagModules.push("mail");

    const options = await runPrompts(projectNameArg, {
      database: (opts.dbType as DatabaseType) ?? undefined,
      git: opts.git,
      install: opts.install,
      modules: flagModules.length > 0 ? flagModules : undefined,
      provider: (opts.provider as DatabaseProvider) ?? undefined,
    });

    p.log.step(pc.bold("Scaffolding project..."));

    await scaffold(options, pm);

    const runCmd = getRunCommand(pm);

    p.outro(pc.bold(pc.green("Your project is ready!")));

    console.log();
    console.log(`  ${pc.cyan("cd")} ${options.projectName}`);
    console.log(`  ${pc.cyan(runCmd)} dev`);
    console.log();
  });

// ─── add command ────────────────────────────────────────────

program
  .command("add")
  .description("Add a module to an existing Monostack project")
  .argument("[module]", `Module to add (${Object.keys(MODULES).join(", ")})`)
  .option("--db-type <type>", "Database type (postgres, mysql, sqlite)")
  .option("--provider <provider>", "Database provider")
  .option("--force", "Overwrite modified files without prompting", false)
  .action(async (moduleArg: string | undefined, opts) => {
    const projectDir = findProjectRoot();
    if (!projectDir) {
      logger.error(
        "Could not find a Monostack project. Make sure you're inside a project with turbo.json."
      );
      process.exit(1);
    }

    const pm = detectPackageManager();
    const installedModules = detectInstalledModules(projectDir);
    const projectName = readProjectName(projectDir);

    const result = await runAddPrompts(moduleArg, installedModules, {
      database: opts.dbType,
      provider: opts.provider,
    });

    const templateDir = new URL("../template", import.meta.url).pathname;

    // Install modules in dependency order
    const orderedModules = resolveModuleOrder(result.modules);

    for (const moduleName of orderedModules) {
      const mod = MODULES[moduleName];

      p.log.step(`Adding ${mod.label}...`);

      await mod.add({
        force: opts.force,
        installedModules,
        options: {
          database: result.database,
          git: false,
          install: false,
          modules: result.modules,
          projectName,
          provider: result.provider,
        },
        projectDir,
        templateDir,
      });

      // Interpolate newly added files
      interpolateDir(projectDir, { projectName });

      // Update installed list for subsequent modules
      installedModules.push(moduleName);

      logger.success(`Added ${mod.label}`);
    }

    // Format modified files
    try {
      await execa("npx", ["oxfmt", "--write", "."], {
        cwd: projectDir,
        stdio: "pipe",
      });
    } catch {
      // oxfmt not available
    }

    // Install dependencies
    const oraModule = await import("ora");
    const ora = oraModule.default;
    const spinner = ora("Installing dependencies...").start();
    try {
      await installDependencies(projectDir, pm);
      spinner.succeed("Installed dependencies");
    } catch {
      spinner.fail("Failed to install dependencies");
      logger.warn("Run install manually.");
    }

    p.outro(pc.bold(pc.green("Modules added successfully!")));
  });

// ─── Default to create when run as create-monostack ─────────

// If invoked as `create-monostack`, treat args as `create` command
const invoked = process.argv[1];
if (invoked && /create-monostack/.test(invoked)) {
  // Insert "create" as the subcommand
  process.argv.splice(2, 0, "create");
}

program.parse();
