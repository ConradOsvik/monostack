import * as p from "@clack/prompts";
import pc from "picocolors";

import {
  DEFAULT_PROJECT_NAME,
  PROVIDER_MAP,
  type DatabaseProvider,
  type DatabaseType,
  type ModuleName,
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

  // Module selection
  let modules: ModuleName[] = flags.modules ?? [];

  if (modules.length === 0 && !flags.modules) {
    const selected = await p.multiselect({
      message: "Which modules do you want to include?",
      options: [
        { label: "Database (Drizzle)", value: "db" },
        { label: "Authentication (Better Auth)", value: "auth" },
        { label: "Native App (Expo + React Native)", value: "native" },
        { label: "Email (React Email + Resend)", value: "mail" },
      ],
      required: false,
    });

    if (p.isCancel(selected)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    modules = selected as ModuleName[];
  }

  // Auto-add db if auth is selected (auth depends on db)
  if (modules.includes("auth") && !modules.includes("db")) {
    modules = ["db", ...modules];
    p.log.info(
      pc.dim("Authentication requires a database — adding database module.")
    );
  }

  // Database type selection
  let database: DatabaseType | null = flags.database ?? null;
  if (modules.includes("db") && !database) {
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
  let provider: DatabaseProvider | null = flags.provider ?? null;
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
    database,
    git,
    install,
    modules,
    projectName,
    provider,
  };
}
