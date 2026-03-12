import * as p from "@clack/prompts";
import { Command } from "commander";
import pc from "picocolors";

import type { DatabaseProvider, DatabaseType, OrmType } from "./constants.js";
import { runPrompts } from "./prompts.js";
import { scaffold } from "./scaffold.js";
import { detectPackageManager, getRunCommand } from "./utils/pkg-manager.js";

const program = new Command();

program
  .name("create-monostack")
  .description("Scaffold an opinionated fullstack monorepo")
  .version("0.1.0")
  .argument("[project-name]", "Name of the project")
  .option("--auth", "Include Better Auth")
  .option("--no-auth", "Exclude Better Auth")
  .option("--orm <orm>", "ORM to use (drizzle or prisma)")
  .option("--db <database>", "Database type (postgres, mysql, sqlite)")
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

    const options = await runPrompts(projectNameArg, {
      auth: opts.auth === false ? false : opts.auth === true ? true : undefined,
      database: (opts.db as DatabaseType) ?? undefined,
      git: opts.git,
      install: opts.install,
      orm: (opts.orm as OrmType) ?? undefined,
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

program.parse();
