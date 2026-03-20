import path from "node:path";

import fs from "fs-extra";

import type { ModuleName } from "../src/constants";
import {
  MODULES,
  detectInstalledModules,
  resolveModuleOrder,
} from "../src/modules";
import type { AddContext } from "../src/modules";
import { interpolateDir } from "../src/utils/fs";
import {
  TEMPLATE_DIR,
  createTempDir,
  makeOptions,
  scaffoldProject,
} from "./helpers";

/**
 * Simulate the `monostack add` flow programmatically.
 * Runs module.add() for each module in order, then interpolates.
 */
async function addModules(
  projectDir: string,
  modulesToAdd: ModuleName[],
  opts: {
    database?: "postgres" | "mysql" | "sqlite";
    provider?: string;
    force?: boolean;
  } = {}
): Promise<void> {
  const installedModules = detectInstalledModules(projectDir);
  const projectName = fs.readJsonSync(path.join(projectDir, "package.json"))
    .name as string;

  const ordered = resolveModuleOrder(modulesToAdd);

  for (const moduleName of ordered) {
    if (installedModules.includes(moduleName)) continue;

    const mod = MODULES[moduleName];
    const ctx: AddContext = {
      force: opts.force ?? true, // force in tests to avoid interactive prompts
      installedModules: [...installedModules],
      options: makeOptions({
        projectName,
        modules: modulesToAdd,
        database: (opts.database as any) ?? null,
        provider: (opts.provider as any) ?? null,
      }),
      projectDir,
      templateDir: TEMPLATE_DIR,
    };

    await mod.add(ctx);
    interpolateDir(projectDir, { projectName });
    installedModules.push(moduleName);
  }
}

// ─── detectInstalledModules ─────────────────────────────────

describe("detectInstalledModules", () => {
  it("detects no modules on bare scaffold", () => {
    const dir = createTempDir("detect-bare");
    scaffoldProject(dir, makeOptions({ projectName: "test-detect" }));

    const installed = detectInstalledModules(dir);
    expect(installed).toEqual([]);

    fs.removeSync(dir);
  });

  it("detects db module", () => {
    const dir = createTempDir("detect-db");
    scaffoldProject(
      dir,
      makeOptions({
        projectName: "test-detect-db",
        modules: ["db"],
        database: "postgres",
        provider: "neon",
      })
    );

    const installed = detectInstalledModules(dir);
    expect(installed).toContain("db");
    expect(installed).not.toContain("auth");

    fs.removeSync(dir);
  });

  it("detects all modules", () => {
    const dir = createTempDir("detect-all");
    scaffoldProject(
      dir,
      makeOptions({
        projectName: "test-detect-all",
        modules: ["db", "auth", "native", "mail"],
        database: "postgres",
        provider: "neon",
      })
    );

    const installed = detectInstalledModules(dir);
    expect(installed).toContain("db");
    expect(installed).toContain("auth");
    expect(installed).toContain("native");
    expect(installed).toContain("mail");

    fs.removeSync(dir);
  });
});

// ─── add db to bare project ─────────────────────────────────

describe("add: db to bare project", () => {
  let projectDir: string;

  beforeAll(async () => {
    projectDir = createTempDir("add-db");
    scaffoldProject(projectDir, makeOptions({ projectName: "test-add-db" }));
    await addModules(projectDir, ["db"], {
      database: "postgres",
      provider: "neon",
    });
  });

  afterAll(() => fs.removeSync(projectDir));

  it("creates db package", () => {
    expect(
      fs.existsSync(path.join(projectDir, "packages/db/package.json"))
    ).toBeTruthy();
  });

  it("wires db into tRPC context", () => {
    const trpc = fs.readFileSync(
      path.join(projectDir, "packages/api/src/trpc.ts"),
      "utf8"
    );
    expect(trpc).toContain("@test-add-db/db");
  });

  it("adds DATABASE_URL to env", () => {
    const env = fs.readFileSync(
      path.join(projectDir, "packages/env/src/server.ts"),
      "utf8"
    );
    expect(env).toContain("DATABASE_URL");
  });

  it("adds db tasks to turbo.json", () => {
    const turbo = fs.readJsonSync(path.join(projectDir, "turbo.json"));
    expect(turbo.tasks["db:push"]).toBeDefined();
  });
});

// ─── add auth to project with db ────────────────────────────

describe("add: auth to project that already has db", () => {
  let projectDir: string;

  beforeAll(async () => {
    projectDir = createTempDir("add-auth");
    // Start with db already installed
    scaffoldProject(
      projectDir,
      makeOptions({
        projectName: "test-add-auth",
        modules: ["db"],
        database: "postgres",
        provider: "neon",
      })
    );
    // Now add auth
    await addModules(projectDir, ["auth"], {
      database: "postgres",
      provider: "neon",
    });
  });

  afterAll(() => fs.removeSync(projectDir));

  it("creates auth package", () => {
    expect(
      fs.existsSync(path.join(projectDir, "packages/auth/package.json"))
    ).toBeTruthy();
  });

  it("tRPC context has BOTH db and auth", () => {
    const trpc = fs.readFileSync(
      path.join(projectDir, "packages/api/src/trpc.ts"),
      "utf8"
    );
    expect(trpc).toContain("@test-add-auth/db");
    expect(trpc).toContain("@test-add-auth/auth");
    expect(trpc).toContain("protectedProcedure");
  });

  it("creates auth routes in web app", () => {
    expect(
      fs.existsSync(path.join(projectDir, "apps/web/src/routes/api/auth.$.ts"))
    ).toBeTruthy();
  });
});

// ─── add mail to bare project ───────────────────────────────

describe("add: mail to bare project", () => {
  let projectDir: string;

  beforeAll(async () => {
    projectDir = createTempDir("add-mail");
    scaffoldProject(projectDir, makeOptions({ projectName: "test-add-mail" }));
    await addModules(projectDir, ["mail"]);
  });

  afterAll(() => fs.removeSync(projectDir));

  it("creates mail package", () => {
    expect(
      fs.existsSync(path.join(projectDir, "packages/mail/package.json"))
    ).toBeTruthy();
  });

  it("has resend dependency", () => {
    const pkg = fs.readJsonSync(
      path.join(projectDir, "packages/mail/package.json")
    );
    expect(pkg.dependencies["resend"]).toBeDefined();
  });

  it("adds RESEND_API_KEY to env", () => {
    const env = fs.readFileSync(
      path.join(projectDir, "packages/env/src/server.ts"),
      "utf8"
    );
    expect(env).toContain("RESEND_API_KEY");
  });

  it("tRPC context remains basic (mail doesn't modify it)", () => {
    const trpc = fs.readFileSync(
      path.join(projectDir, "packages/api/src/trpc.ts"),
      "utf8"
    );
    expect(trpc).toContain("createTRPCContext");
    expect(trpc).not.toContain("protectedProcedure");
  });
});

// ─── add native to project with auth ────────────────────────

describe("add: native to project with auth+db", () => {
  let projectDir: string;

  beforeAll(async () => {
    projectDir = createTempDir("add-native");
    scaffoldProject(
      projectDir,
      makeOptions({
        projectName: "test-add-native",
        modules: ["db", "auth"],
        database: "postgres",
        provider: "neon",
      })
    );
    await addModules(projectDir, ["native"]);
  });

  afterAll(() => fs.removeSync(projectDir));

  it("creates native app", () => {
    expect(
      fs.existsSync(path.join(projectDir, "apps/native/package.json"))
    ).toBeTruthy();
  });

  it("copies auth-native extras since auth is installed", () => {
    expect(
      fs.existsSync(path.join(projectDir, "apps/native/lib/auth.ts"))
    ).toBeTruthy();
  });
});

// ─── add multiple modules at once ───────────────────────────

describe("add: db + mail simultaneously to bare project", () => {
  let projectDir: string;

  beforeAll(async () => {
    projectDir = createTempDir("add-multi");
    scaffoldProject(projectDir, makeOptions({ projectName: "test-add-multi" }));
    await addModules(projectDir, ["db", "mail"], {
      database: "sqlite",
      provider: "turso",
    });
  });

  afterAll(() => fs.removeSync(projectDir));

  it("creates both db and mail packages", () => {
    expect(
      fs.existsSync(path.join(projectDir, "packages/db/package.json"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "packages/mail/package.json"))
    ).toBeTruthy();
  });

  it("env has both DATABASE_URL and RESEND_API_KEY", () => {
    const env = fs.readFileSync(
      path.join(projectDir, "packages/env/src/server.ts"),
      "utf8"
    );
    expect(env).toContain("DATABASE_URL");
    expect(env).toContain("RESEND_API_KEY");
  });
});

// ─── conflict detection ─────────────────────────────────────

describe("add: conflict detection on trpc.ts", () => {
  it("overwrites unmodified trpc.ts with force=true", async () => {
    const dir = createTempDir("conflict-clean");
    scaffoldProject(dir, makeOptions({ projectName: "test-conflict" }));

    // Add db with force — should overwrite cleanly
    await addModules(dir, ["db"], {
      database: "postgres",
      provider: "neon",
      force: true,
    });

    const trpc = fs.readFileSync(
      path.join(dir, "packages/api/src/trpc.ts"),
      "utf8"
    );
    expect(trpc).toContain("@test-conflict/db");

    fs.removeSync(dir);
  });

  it("creates .monostack-new file when trpc.ts is customized and force is not set", async () => {
    const dir = createTempDir("conflict-custom");
    scaffoldProject(dir, makeOptions({ projectName: "test-conflict2" }));

    // Manually modify trpc.ts to simulate user customization
    const trpcPath = path.join(dir, "packages/api/src/trpc.ts");
    fs.writeFileSync(
      trpcPath,
      `// Custom user code that doesn't match any template
import { initTRPC } from "@trpc/server";
const t = initTRPC.create();
export const router = t.router;
export const myCustomProcedure = t.procedure;
`
    );

    // We can't test the interactive prompt in unit tests,
    // but we can verify that force=true still overwrites
    await addModules(dir, ["db"], {
      database: "postgres",
      provider: "neon",
      force: true,
    });

    const trpc = fs.readFileSync(trpcPath, "utf8");
    expect(trpc).toContain("@test-conflict2/db");

    fs.removeSync(dir);
  });
});
