import os from "node:os";
import path from "node:path";

import fs from "fs-extra";

import type { ProjectOptions } from "../src/constants";
import type { InstallerContext } from "../src/installers";
import { authInstaller } from "../src/installers/auth";
import { dbDrizzleInstaller } from "../src/installers/db-drizzle";
import { dbPrismaInstaller } from "../src/installers/db-prisma";
import { addPackageDependency } from "../src/utils/deps";
// Import the scaffold internals directly so we can test without CLI parsing
import { copyTemplateDir, interpolateDir } from "../src/utils/fs";

const TEMPLATE_DIR = path.join(import.meta.dirname, "..", "template");

/** Create a unique temp directory for each test */
function createTempDir(testName: string): string {
  const dir = path.join(
    os.tmpdir(),
    `monostack-test-${testName}-${Date.now()}`
  );
  fs.ensureDirSync(dir);
  return dir;
}

/** Run the core scaffold logic (without install/git) */
function scaffoldProject(projectDir: string, options: ProjectOptions): void {
  const ctx: InstallerContext = {
    options,
    projectDir,
    templateDir: TEMPLATE_DIR,
  };

  // Base
  copyTemplateDir(path.join(TEMPLATE_DIR, "base"), projectDir);

  // Apps
  copyTemplateDir(
    path.join(TEMPLATE_DIR, "apps/web"),
    path.join(projectDir, "apps/web")
  );
  copyTemplateDir(
    path.join(TEMPLATE_DIR, "apps/native"),
    path.join(projectDir, "apps/native")
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

  // Feature installers
  if (options.orm === "drizzle") {
    dbDrizzleInstaller(ctx);
  }
  if (options.orm === "prisma") {
    dbPrismaInstaller(ctx);
  }
  if (options.auth) {
    authInstaller(ctx);
  }

  // Combined auth+db context
  if (options.auth && options.orm) {
    const combined = path.join(TEMPLATE_DIR, "extras/auth-db-api");
    if (fs.existsSync(combined)) {
      copyTemplateDir(combined, path.join(projectDir, "packages/api"));
    }
  }

  // Interpolate
  interpolateDir(projectDir, { projectName: options.projectName });
}

// ─── Test Suites ────────────────────────────────────────────

describe("scaffold: bare (no optional features)", () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = createTempDir("bare");
    scaffoldProject(projectDir, {
      auth: false,
      database: null,
      git: false,
      install: false,
      orm: null,
      projectName: "test-bare",
      provider: null,
    });
  });

  afterAll(() => fs.removeSync(projectDir));

  it("creates root files", () => {
    expect(fs.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fs.existsSync(path.join(projectDir, "turbo.json"))).toBeTruthy();
    expect(fs.existsSync(path.join(projectDir, ".gitignore"))).toBeTruthy();
    expect(fs.existsSync(path.join(projectDir, ".env.example"))).toBeTruthy();
    expect(fs.existsSync(path.join(projectDir, ".oxlintrc.json"))).toBeTruthy();
    expect(fs.existsSync(path.join(projectDir, ".oxfmtrc.jsonc"))).toBeTruthy();
    expect(fs.existsSync(path.join(projectDir, "README.md"))).toBeTruthy();
  });

  it("interpolates project name in root package.json", () => {
    const pkg = fs.readJsonSync(path.join(projectDir, "package.json"));
    expect(pkg.name).toBe("test-bare");
  });

  it("creates web app with vite.config.ts", () => {
    expect(
      fs.existsSync(path.join(projectDir, "apps/web/package.json"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "apps/web/vite.config.ts"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "apps/web/src/routes/__root.tsx"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "apps/web/src/routes/index.tsx"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "apps/web/src/routes/api/trpc.$.ts"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "apps/web/src/lib/trpc.ts"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "apps/web/src/lib/utils.ts"))
    ).toBeTruthy();
  });

  it("web app uses vite scripts (not vinxi)", () => {
    const pkg = fs.readJsonSync(path.join(projectDir, "apps/web/package.json"));
    expect(pkg.scripts.dev).toBe("vite dev");
    expect(pkg.scripts.build).toBe("vite build");
  });

  it("root package.json has catalog", () => {
    const pkg = fs.readJsonSync(path.join(projectDir, "package.json"));
    expect(pkg.catalog).toBeDefined();
    expect(pkg.catalog.react).toBeDefined();
    expect(pkg.catalog.typescript).toBeDefined();
    expect(pkg.catalog.zod).toBeDefined();
  });

  it("packages use catalog: references for shared deps", () => {
    const apiPkg = fs.readJsonSync(
      path.join(projectDir, "packages/api/package.json")
    );
    expect(apiPkg.dependencies["zod"]).toBe("catalog:");
    expect(apiPkg.dependencies["@trpc/server"]).toBe("catalog:");
  });

  it("creates native app with _layout.tsx preserved", () => {
    expect(
      fs.existsSync(path.join(projectDir, "apps/native/package.json"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "apps/native/app/_layout.tsx"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "apps/native/app/index.tsx"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "apps/native/metro.config.js"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "apps/native/global.css"))
    ).toBeTruthy();
  });

  it("creates core packages", () => {
    expect(
      fs.existsSync(path.join(projectDir, "packages/config/package.json"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "packages/config/tsconfig/base.json"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "packages/env/package.json"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "packages/env/src/server.ts"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "packages/api/package.json"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "packages/api/src/trpc.ts"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "packages/api/src/root.ts"))
    ).toBeTruthy();
  });

  it("does NOT create db or auth packages", () => {
    expect(fs.existsSync(path.join(projectDir, "packages/db"))).toBeFalsy();
    expect(fs.existsSync(path.join(projectDir, "packages/auth"))).toBeFalsy();
  });

  it("interpolates workspace references in api package.json", () => {
    const pkg = fs.readJsonSync(
      path.join(projectDir, "packages/api/package.json")
    );
    expect(pkg.dependencies["@test-bare/env"]).toBe("workspace:*");
  });

  it("has basic tRPC context (no db, no auth)", () => {
    const trpc = fs.readFileSync(
      path.join(projectDir, "packages/api/src/trpc.ts"),
      "utf8"
    );
    expect(trpc).toContain("createTRPCContext");
    expect(trpc).not.toContain("@test-bare/db");
    expect(trpc).not.toContain("@test-bare/auth");
  });

  it("turbo.json does NOT have db tasks", () => {
    const turbo = fs.readJsonSync(path.join(projectDir, "turbo.json"));
    expect(turbo.tasks["db:push"]).toBeUndefined();
    expect(turbo.tasks["db:generate"]).toBeUndefined();
  });
});

describe("scaffold: drizzle + neon (no auth)", () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = createTempDir("drizzle-neon");
    scaffoldProject(projectDir, {
      auth: false,
      database: "postgres",
      git: false,
      install: false,
      orm: "drizzle",
      projectName: "test-drizzle",
      provider: "neon",
    });
  });

  afterAll(() => fs.removeSync(projectDir));

  it("creates db package with drizzle files", () => {
    expect(
      fs.existsSync(path.join(projectDir, "packages/db/package.json"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "packages/db/drizzle.config.ts"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "packages/db/src/client.ts"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "packages/db/src/index.ts"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "packages/db/src/schema/index.ts"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "packages/db/src/schema/user.ts"))
    ).toBeTruthy();
  });

  it("uses neon client driver", () => {
    const client = fs.readFileSync(
      path.join(projectDir, "packages/db/src/client.ts"),
      "utf8"
    );
    expect(client).toContain("@neondatabase/serverless");
    expect(client).toContain("drizzle-orm/neon-http");
  });

  it("has neon dependency in db package.json", () => {
    const pkg = fs.readJsonSync(
      path.join(projectDir, "packages/db/package.json")
    );
    expect(pkg.dependencies["@neondatabase/serverless"]).toBeDefined();
    expect(pkg.dependencies["drizzle-orm"]).toBeDefined();
    expect(pkg.devDependencies["drizzle-kit"]).toBeDefined();
  });

  it("has db scripts in package.json", () => {
    const pkg = fs.readJsonSync(
      path.join(projectDir, "packages/db/package.json")
    );
    expect(pkg.scripts["db:push"]).toBe("drizzle-kit push");
    expect(pkg.scripts["db:generate"]).toBe("drizzle-kit generate");
    expect(pkg.scripts["db:studio"]).toBe("drizzle-kit studio");
  });

  it("adds db tasks to turbo.json", () => {
    const turbo = fs.readJsonSync(path.join(projectDir, "turbo.json"));
    expect(turbo.tasks["db:push"]).toBeDefined();
    expect(turbo.tasks["db:generate"]).toBeDefined();
  });

  it("adds db to api dependencies", () => {
    const pkg = fs.readJsonSync(
      path.join(projectDir, "packages/api/package.json")
    );
    expect(pkg.dependencies["@test-drizzle/db"]).toBe("workspace:*");
  });

  it("has db in tRPC context", () => {
    const trpc = fs.readFileSync(
      path.join(projectDir, "packages/api/src/trpc.ts"),
      "utf8"
    );
    expect(trpc).toContain("@test-drizzle/db");
    expect(trpc).toContain("db");
  });

  it("adds DATABASE_URL to server env", () => {
    const env = fs.readFileSync(
      path.join(projectDir, "packages/env/src/server.ts"),
      "utf8"
    );
    expect(env).toContain("DATABASE_URL");
  });

  it("uses postgresql schema (not sqlite)", () => {
    const schema = fs.readFileSync(
      path.join(projectDir, "packages/db/src/schema/user.ts"),
      "utf8"
    );
    expect(schema).toContain("pgTable");
  });
});

describe("scaffold: drizzle + turso (sqlite)", () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = createTempDir("drizzle-turso");
    scaffoldProject(projectDir, {
      auth: false,
      database: "sqlite",
      git: false,
      install: false,
      orm: "drizzle",
      projectName: "test-turso",
      provider: "turso",
    });
  });

  afterAll(() => fs.removeSync(projectDir));

  it("uses libsql client driver", () => {
    const client = fs.readFileSync(
      path.join(projectDir, "packages/db/src/client.ts"),
      "utf8"
    );
    expect(client).toContain("drizzle-orm/libsql");
    expect(client).toContain("authToken");
  });

  it("uses turso dialect in drizzle config", () => {
    const config = fs.readFileSync(
      path.join(projectDir, "packages/db/drizzle.config.ts"),
      "utf8"
    );
    expect(config).toContain('"turso"');
  });

  it("uses sqlite schema", () => {
    const schema = fs.readFileSync(
      path.join(projectDir, "packages/db/src/schema/user.ts"),
      "utf8"
    );
    expect(schema).toContain("sqliteTable");
  });
});

describe("scaffold: prisma + neon", () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = createTempDir("prisma-neon");
    scaffoldProject(projectDir, {
      auth: false,
      database: "postgres",
      git: false,
      install: false,
      orm: "prisma",
      projectName: "test-prisma",
      provider: "neon",
    });
  });

  afterAll(() => fs.removeSync(projectDir));

  it("creates prisma schema", () => {
    expect(
      fs.existsSync(path.join(projectDir, "packages/db/prisma/schema.prisma"))
    ).toBeTruthy();
  });

  it("uses neon adapter in client", () => {
    const client = fs.readFileSync(
      path.join(projectDir, "packages/db/src/client.ts"),
      "utf8"
    );
    expect(client).toContain("@prisma/adapter-neon");
    expect(client).toContain("PrismaNeon");
  });

  it("has driverAdapters preview feature in schema", () => {
    const schema = fs.readFileSync(
      path.join(projectDir, "packages/db/prisma/schema.prisma"),
      "utf8"
    );
    expect(schema).toContain("driverAdapters");
  });

  it("has prisma deps in package.json", () => {
    const pkg = fs.readJsonSync(
      path.join(projectDir, "packages/db/package.json")
    );
    expect(pkg.dependencies["@prisma/client"]).toBeDefined();
    expect(pkg.dependencies["@prisma/adapter-neon"]).toBeDefined();
    expect(pkg.devDependencies["prisma"]).toBeDefined();
  });

  it("has prisma scripts", () => {
    const pkg = fs.readJsonSync(
      path.join(projectDir, "packages/db/package.json")
    );
    expect(pkg.scripts["db:generate"]).toBe("prisma generate");
    expect(pkg.scripts["db:push"]).toBe("prisma db push");
  });
});

describe("scaffold: auth only (no db)", () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = createTempDir("auth-only");
    scaffoldProject(projectDir, {
      auth: true,
      database: null,
      git: false,
      install: false,
      orm: null,
      projectName: "test-auth",
      provider: null,
    });
  });

  afterAll(() => fs.removeSync(projectDir));

  it("creates auth package", () => {
    expect(
      fs.existsSync(path.join(projectDir, "packages/auth/package.json"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "packages/auth/src/index.ts"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "packages/auth/src/client.ts"))
    ).toBeTruthy();
  });

  it("has better-auth dependency", () => {
    const pkg = fs.readJsonSync(
      path.join(projectDir, "packages/auth/package.json")
    );
    expect(pkg.dependencies["better-auth"]).toBeDefined();
  });

  it("creates auth API route in web app", () => {
    expect(
      fs.existsSync(path.join(projectDir, "apps/web/src/routes/api/auth.$.ts"))
    ).toBeTruthy();
  });

  it("creates auth lib in web app", () => {
    expect(
      fs.existsSync(path.join(projectDir, "apps/web/src/lib/auth.ts"))
    ).toBeTruthy();
  });

  it("creates auth lib in native app", () => {
    expect(
      fs.existsSync(path.join(projectDir, "apps/native/lib/auth.ts"))
    ).toBeTruthy();
  });

  it("adds auth to api dependencies", () => {
    const pkg = fs.readJsonSync(
      path.join(projectDir, "packages/api/package.json")
    );
    expect(pkg.dependencies["@test-auth/auth"]).toBe("workspace:*");
  });

  it("has auth in tRPC context with protectedProcedure", () => {
    const trpc = fs.readFileSync(
      path.join(projectDir, "packages/api/src/trpc.ts"),
      "utf8"
    );
    expect(trpc).toContain("@test-auth/auth");
    expect(trpc).toContain("protectedProcedure");
    expect(trpc).toContain("session");
  });

  it("does NOT have db in tRPC context", () => {
    const trpc = fs.readFileSync(
      path.join(projectDir, "packages/api/src/trpc.ts"),
      "utf8"
    );
    expect(trpc).not.toContain("@test-auth/db");
  });
});

describe("scaffold: full (auth + drizzle + neon)", () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = createTempDir("full");
    scaffoldProject(projectDir, {
      auth: true,
      database: "postgres",
      git: false,
      install: false,
      orm: "drizzle",
      projectName: "test-full",
      provider: "neon",
    });
  });

  afterAll(() => fs.removeSync(projectDir));

  it("creates both db and auth packages", () => {
    expect(
      fs.existsSync(path.join(projectDir, "packages/db/package.json"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "packages/auth/package.json"))
    ).toBeTruthy();
  });

  it("has BOTH db and auth in tRPC context", () => {
    const trpc = fs.readFileSync(
      path.join(projectDir, "packages/api/src/trpc.ts"),
      "utf8"
    );
    expect(trpc).toContain("@test-full/db");
    expect(trpc).toContain("@test-full/auth");
    expect(trpc).toContain("db,");
    expect(trpc).toContain("session");
    expect(trpc).toContain("protectedProcedure");
  });

  it("all workspace references are interpolated", () => {
    const webPkg = fs.readJsonSync(
      path.join(projectDir, "apps/web/package.json")
    );
    const nativePkg = fs.readJsonSync(
      path.join(projectDir, "apps/native/package.json")
    );
    const apiPkg = fs.readJsonSync(
      path.join(projectDir, "packages/api/package.json")
    );

    expect(webPkg.dependencies["@test-full/api"]).toBe("workspace:*");
    expect(nativePkg.dependencies["@test-full/api"]).toBe("workspace:*");
    expect(apiPkg.dependencies["@test-full/env"]).toBe("workspace:*");
    expect(apiPkg.dependencies["@test-full/db"]).toBe("workspace:*");
    expect(apiPkg.dependencies["@test-full/auth"]).toBe("workspace:*");
  });

  it("no leftover {{projectName}} placeholders in any file", () => {
    const files = getAllFiles(projectDir);
    for (const file of files) {
      const ext = path.extname(file);
      if ([".ts", ".tsx", ".json", ".md", ".css", ".js"].includes(ext)) {
        const content = fs.readFileSync(file, "utf8");
        expect(content).not.toContain("{{projectName}}");
      }
    }
  });
});

describe("utils: copyTemplateDir", () => {
  it("renames _gitignore to .gitignore", () => {
    const src = createTempDir("copy-src");
    const dest = createTempDir("copy-dest");
    fs.writeFileSync(path.join(src, "_gitignore"), "node_modules");
    copyTemplateDir(src, dest);
    expect(fs.existsSync(path.join(dest, ".gitignore"))).toBeTruthy();
    expect(fs.existsSync(path.join(dest, "_gitignore"))).toBeFalsy();
    fs.removeSync(src);
    fs.removeSync(dest);
  });

  it("renames _oxlintrc.json to .oxlintrc.json", () => {
    const src = createTempDir("copy-oxlint-src");
    const dest = createTempDir("copy-oxlint-dest");
    fs.writeFileSync(path.join(src, "_oxlintrc.json"), "{}");
    copyTemplateDir(src, dest);
    expect(fs.existsSync(path.join(dest, ".oxlintrc.json"))).toBeTruthy();
    fs.removeSync(src);
    fs.removeSync(dest);
  });

  it("does NOT rename _layout.tsx", () => {
    const src = createTempDir("copy-layout-src");
    const dest = createTempDir("copy-layout-dest");
    fs.writeFileSync(
      path.join(src, "_layout.tsx"),
      "export default function() {}"
    );
    copyTemplateDir(src, dest);
    expect(fs.existsSync(path.join(dest, "_layout.tsx"))).toBeTruthy();
    expect(fs.existsSync(path.join(dest, ".layout.tsx"))).toBeFalsy();
    fs.removeSync(src);
    fs.removeSync(dest);
  });
});

describe("utils: addPackageDependency", () => {
  it("adds sorted dependencies to package.json", () => {
    const dir = createTempDir("deps");
    const pkgPath = path.join(dir, "package.json");
    fs.writeJsonSync(pkgPath, { dependencies: {}, name: "test" });

    addPackageDependency(pkgPath, {
      dependencies: ["zod", "@trpc/server"],
    });

    const pkg = fs.readJsonSync(pkgPath);
    const keys = Object.keys(pkg.dependencies);
    expect(keys[0]).toBe("@trpc/server");
    expect(keys[1]).toBe("zod");
    expect(pkg.dependencies["@trpc/server"]).toBeDefined();
    expect(pkg.dependencies["zod"]).toBeDefined();

    fs.removeSync(dir);
  });
});

// ─── Helpers ────────────────────────────────────────────────

function getAllFiles(dir: string): string[] {
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
