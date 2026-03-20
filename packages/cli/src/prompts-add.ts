import * as p from "@clack/prompts";
import pc from "picocolors";

import {
  PROVIDER_MAP,
  type DatabaseProvider,
  type DatabaseType,
  type ModuleName,
} from "./constants.js";
import { MODULES } from "./modules/index.js";

export interface AddPromptResult {
  modules: ModuleName[];
  database: DatabaseType | null;
  provider: DatabaseProvider | null;
}

export async function runAddPrompts(
  moduleArg: string | undefined,
  installedModules: ModuleName[],
  flags: { database?: string; provider?: string }
): Promise<AddPromptResult> {
  p.intro(pc.bgCyan(pc.black(" Adding modules to your Monostack project ")));

  // Module selection
  let modules: ModuleName[];

  if (moduleArg) {
    if (!(moduleArg in MODULES)) {
      p.log.error(
        `Unknown module "${moduleArg}". Available: ${Object.keys(MODULES).join(", ")}`
      );
      process.exit(1);
    }
    modules = [moduleArg as ModuleName];
  } else {
    const available = (Object.keys(MODULES) as ModuleName[]).filter(
      (m) => !installedModules.includes(m)
    );

    if (available.length === 0) {
      p.log.info("All modules are already installed!");
      process.exit(0);
    }

    const selected = await p.multiselect({
      message: "Which modules do you want to add?",
      options: available.map((m) => ({
        label: MODULES[m].label,
        value: m,
      })),
      required: true,
    });

    if (p.isCancel(selected)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    modules = selected as ModuleName[];
  }

  // Check if already installed
  for (const mod of modules) {
    if (installedModules.includes(mod)) {
      p.log.warn(`Module "${mod}" is already installed — skipping.`);
      modules = modules.filter((m) => m !== mod);
    }
  }

  if (modules.length === 0) {
    p.log.info("Nothing to add.");
    process.exit(0);
  }

  // Auto-add dependencies
  for (const mod of [...modules]) {
    const def = MODULES[mod];
    for (const dep of def.dependencies) {
      if (!installedModules.includes(dep) && !modules.includes(dep)) {
        modules = [dep, ...modules];
        p.log.info(
          pc.dim(`"${mod}" requires "${dep}" — adding it automatically.`)
        );
      }
    }
  }

  // Database prompts (if db is being added)
  let database: DatabaseType | null = (flags.database as DatabaseType) ?? null;
  let provider: DatabaseProvider | null =
    (flags.provider as DatabaseProvider) ?? null;

  if (modules.includes("db")) {
    if (!database) {
      const dbChoice = await p.select({
        message: "Which database?",
        options: [
          { label: "PostgreSQL", value: "postgres" },
          { label: "MySQL", value: "mysql" },
          { label: "SQLite", value: "sqlite" },
        ],
      });

      if (p.isCancel(dbChoice)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
      }
      database = dbChoice as DatabaseType;
    }

    if (!provider) {
      const providers = PROVIDER_MAP[database];
      const providerChoice = await p.select({
        message: "Which database provider?",
        options: providers,
      });

      if (p.isCancel(providerChoice)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
      }
      provider = providerChoice as DatabaseProvider;
    }
  }

  return { modules, database, provider };
}
