import * as p from "@clack/prompts";
import pc from "picocolors";

import {
  DEFAULT_PROJECT_NAME,
  PROVIDER_MAP,
  type DatabaseProvider,
  type DatabaseType,
  type OrmType,
  type ProjectOptions,
} from "./constants.js";

export async function runPrompts(
  projectNameArg: string | undefined,
  flags: Partial<ProjectOptions>
): Promise<ProjectOptions> {
  p.intro(pc.bgCyan(pc.black(" Creating a new Monostack project ")));

  const projectName =
    projectNameArg ??
    ((await p.text({
      defaultValue: DEFAULT_PROJECT_NAME,
      message: "Project name",
      placeholder: DEFAULT_PROJECT_NAME,
      validate: (value) => {
        if (!value) {
          return "Project name is required";
        }
        if (!/^[a-z0-9-]+$/.test(value)) {
          return "Project name must be lowercase alphanumeric with hyphens";
        }
      },
    })) as string);

  if (p.isCancel(projectName)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  // Features selection
  let auth = flags.auth ?? false;
  let hasDb = flags.orm !== undefined;

  if (flags.auth === undefined && flags.orm === undefined) {
    const features = await p.multiselect({
      message: "Which optional features do you want?",
      options: [
        { label: "Authentication (Better Auth)", value: "auth" },
        { label: "Database", value: "db" },
      ],
      required: false,
    });

    if (p.isCancel(features)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    auth = (features as string[]).includes("auth");
    hasDb = (features as string[]).includes("db");
  }

  // ORM selection
  let orm: OrmType | null = flags.orm ?? null;
  if (hasDb && !orm) {
    const ormChoice = await p.select({
      message: "Which ORM?",
      options: [
        { label: "Drizzle (Recommended)", value: "drizzle" },
        { label: "Prisma", value: "prisma" },
      ],
    });

    if (p.isCancel(ormChoice)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    orm = ormChoice as OrmType;
  }

  // Database type selection
  let database: DatabaseType | null = flags.database ?? null;
  if (orm && !database) {
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

  // Provider selection
  let provider = flags.provider ?? null;
  if (database && !provider) {
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

  // Git init
  let git = flags.git ?? true;
  if (flags.git === undefined) {
    const gitChoice = await p.confirm({
      initialValue: true,
      message: "Initialize a git repository?",
    });

    if (p.isCancel(gitChoice)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    git = gitChoice;
  }

  // Install deps
  let install = flags.install ?? true;
  if (flags.install === undefined) {
    const installChoice = await p.confirm({
      initialValue: true,
      message: "Install dependencies?",
    });

    if (p.isCancel(installChoice)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    install = installChoice;
  }

  return {
    auth,
    database,
    git,
    install,
    orm,
    projectName,
    provider,
  };
}
