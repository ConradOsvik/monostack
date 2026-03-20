import path from "node:path";

import fs from "fs-extra";

import type { ModuleName } from "../src/constants";
import { resolveModuleOrder } from "../src/modules";
import {
  createTempDir,
  getAllFiles,
  makeOptions,
  scaffoldProject,
} from "./helpers";

// ─── Module resolution ──────────────────────────────────────

describe("resolveModuleOrder", () => {
  it("orders dependencies before dependents", () => {
    const order = resolveModuleOrder(["auth", "db"]);
    expect(order.indexOf("db")).toBeLessThan(order.indexOf("auth"));
  });

  it("auto-adds missing dependencies (auth → db)", () => {
    const order = resolveModuleOrder(["auth"]);
    expect(order).toContain("db");
    expect(order.indexOf("db")).toBeLessThan(order.indexOf("auth"));
  });

  it("handles independent modules", () => {
    const order = resolveModuleOrder(["native", "mail"]);
    expect(order).toContain("native");
    expect(order).toContain("mail");
    expect(order).toHaveLength(2);
  });

  it("does not duplicate when dependency is already listed", () => {
    const order = resolveModuleOrder(["db", "auth"]);
    expect(order.filter((m) => m === "db")).toHaveLength(1);
  });

  it("handles all modules at once", () => {
    const order = resolveModuleOrder(["db", "auth", "native", "mail"]);
    expect(order).toHaveLength(4);
    expect(order.indexOf("db")).toBeLessThan(order.indexOf("auth"));
  });
});

// ─── db module only ─────────────────────────────────────────

describe("module: db (drizzle + neon)", () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = createTempDir("mod-db");
    scaffoldProject(
      projectDir,
      makeOptions({
        projectName: "test-db",
        modules: ["db"],
        database: "postgres",
        provider: "neon",
      })
    );
  });

  afterAll(() => fs.removeSync(projectDir));

  it("creates db package", () => {
    expect(
      fs.existsSync(path.join(projectDir, "packages/db/package.json"))
    ).toBeTruthy();
  });

  it("does NOT create auth, mail, or native", () => {
    expect(fs.existsSync(path.join(projectDir, "packages/auth"))).toBeFalsy();
    expect(fs.existsSync(path.join(projectDir, "packages/mail"))).toBeFalsy();
    expect(fs.existsSync(path.join(projectDir, "apps/native"))).toBeFalsy();
  });

  it("tRPC context has db but NOT auth", () => {
    const trpc = fs.readFileSync(
      path.join(projectDir, "packages/api/src/trpc.ts"),
      "utf8"
    );
    expect(trpc).toContain("@test-db/db");
    expect(trpc).not.toContain("@test-db/auth");
    expect(trpc).not.toContain("protectedProcedure");
  });
});

// ─── auth + db ──────────────────────────────────────────────

describe("module: auth + db", () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = createTempDir("mod-auth-db");
    scaffoldProject(
      projectDir,
      makeOptions({
        projectName: "test-authdb",
        modules: ["db", "auth"],
        database: "postgres",
        provider: "neon",
      })
    );
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

  it("auth package has better-auth dependency", () => {
    const pkg = fs.readJsonSync(
      path.join(projectDir, "packages/auth/package.json")
    );
    expect(pkg.dependencies["better-auth"]).toBeDefined();
  });

  it("creates auth API route and lib in web app", () => {
    expect(
      fs.existsSync(path.join(projectDir, "apps/web/src/routes/api/auth.$.ts"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "apps/web/src/lib/auth.ts"))
    ).toBeTruthy();
  });

  it("does NOT create native auth (native not selected)", () => {
    expect(fs.existsSync(path.join(projectDir, "apps/native"))).toBeFalsy();
  });

  it("tRPC context has BOTH db and auth with protectedProcedure", () => {
    const trpc = fs.readFileSync(
      path.join(projectDir, "packages/api/src/trpc.ts"),
      "utf8"
    );
    expect(trpc).toContain("@test-authdb/db");
    expect(trpc).toContain("@test-authdb/auth");
    expect(trpc).toContain("db,");
    expect(trpc).toContain("session");
    expect(trpc).toContain("protectedProcedure");
  });

  it("auth is added as dependency to web and api", () => {
    const webPkg = fs.readJsonSync(
      path.join(projectDir, "apps/web/package.json")
    );
    const apiPkg = fs.readJsonSync(
      path.join(projectDir, "packages/api/package.json")
    );
    expect(webPkg.dependencies["@test-authdb/auth"]).toBe("workspace:*");
    expect(apiPkg.dependencies["@test-authdb/auth"]).toBe("workspace:*");
  });
});

// ─── native module ──────────────────────────────────────────

describe("module: native only", () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = createTempDir("mod-native");
    scaffoldProject(
      projectDir,
      makeOptions({
        projectName: "test-native",
        modules: ["native"],
      })
    );
  });

  afterAll(() => fs.removeSync(projectDir));

  it("creates native app with expected files", () => {
    for (const file of [
      "apps/native/package.json",
      "apps/native/app/_layout.tsx",
      "apps/native/app/index.tsx",
      "apps/native/metro.config.js",
    ]) {
      expect(fs.existsSync(path.join(projectDir, file))).toBeTruthy();
    }
  });

  it("_layout.tsx is NOT renamed to .layout.tsx", () => {
    expect(
      fs.existsSync(path.join(projectDir, "apps/native/app/_layout.tsx"))
    ).toBeTruthy();
  });

  it("does NOT have auth lib (auth not selected)", () => {
    expect(
      fs.existsSync(path.join(projectDir, "apps/native/lib/auth.ts"))
    ).toBeFalsy();
  });
});

describe("module: native + auth + db", () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = createTempDir("mod-native-auth");
    scaffoldProject(
      projectDir,
      makeOptions({
        projectName: "test-nativeauth",
        modules: ["db", "auth", "native"],
        database: "postgres",
        provider: "neon",
      })
    );
  });

  afterAll(() => fs.removeSync(projectDir));

  it("native app has auth lib when both modules selected", () => {
    expect(
      fs.existsSync(path.join(projectDir, "apps/native/lib/auth.ts"))
    ).toBeTruthy();
  });

  it("auth is added as dependency to native app", () => {
    const pkg = fs.readJsonSync(
      path.join(projectDir, "apps/native/package.json")
    );
    expect(pkg.dependencies["@test-nativeauth/auth"]).toBe("workspace:*");
  });
});

// ─── mail module ────────────────────────────────────────────

describe("module: mail", () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = createTempDir("mod-mail");
    scaffoldProject(
      projectDir,
      makeOptions({
        projectName: "test-mail",
        modules: ["mail"],
      })
    );
  });

  afterAll(() => fs.removeSync(projectDir));

  it("creates mail package with expected files", () => {
    for (const file of [
      "packages/mail/package.json",
      "packages/mail/tsconfig.json",
      "packages/mail/src/index.ts",
      "packages/mail/src/emails/index.ts",
      "packages/mail/src/emails/welcome.tsx",
    ]) {
      expect(fs.existsSync(path.join(projectDir, file))).toBeTruthy();
    }
  });

  it("has resend and react-email dependencies", () => {
    const pkg = fs.readJsonSync(
      path.join(projectDir, "packages/mail/package.json")
    );
    expect(pkg.dependencies["resend"]).toBeDefined();
    expect(pkg.dependencies["@react-email/components"]).toBeDefined();
    expect(pkg.devDependencies["react-email"]).toBeDefined();
  });

  it("adds RESEND_API_KEY to server env", () => {
    const env = fs.readFileSync(
      path.join(projectDir, "packages/env/src/server.ts"),
      "utf8"
    );
    expect(env).toContain("RESEND_API_KEY");
  });

  it("adds mail as api dependency", () => {
    const pkg = fs.readJsonSync(
      path.join(projectDir, "packages/api/package.json")
    );
    expect(pkg.dependencies["@test-mail/mail"]).toBe("workspace:*");
  });

  it("mail index.ts imports from interpolated env package", () => {
    const index = fs.readFileSync(
      path.join(projectDir, "packages/mail/src/index.ts"),
      "utf8"
    );
    expect(index).toContain("@test-mail/env/server");
    expect(index).not.toContain("{{projectName}}");
  });
});

// ─── all modules combined ───────────────────────────────────

describe("module: all (db + auth + native + mail)", () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = createTempDir("mod-all");
    scaffoldProject(
      projectDir,
      makeOptions({
        projectName: "test-all",
        modules: ["db", "auth", "native", "mail"],
        database: "postgres",
        provider: "neon",
      })
    );
  });

  afterAll(() => fs.removeSync(projectDir));

  it("creates all packages and apps", () => {
    for (const dir of [
      "packages/db",
      "packages/auth",
      "packages/mail",
      "apps/web",
      "apps/native",
      "packages/api",
      "packages/env",
      "packages/config",
    ]) {
      expect(
        fs.existsSync(path.join(projectDir, dir, "package.json"))
      ).toBeTruthy();
    }
  });

  it("all workspace references are correctly interpolated", () => {
    const apiPkg = fs.readJsonSync(
      path.join(projectDir, "packages/api/package.json")
    );
    expect(apiPkg.dependencies["@test-all/env"]).toBe("workspace:*");
    expect(apiPkg.dependencies["@test-all/db"]).toBe("workspace:*");
    expect(apiPkg.dependencies["@test-all/auth"]).toBe("workspace:*");
    expect(apiPkg.dependencies["@test-all/mail"]).toBe("workspace:*");
  });

  it("server env has both DATABASE_URL and RESEND_API_KEY", () => {
    const env = fs.readFileSync(
      path.join(projectDir, "packages/env/src/server.ts"),
      "utf8"
    );
    expect(env).toContain("DATABASE_URL");
    expect(env).toContain("RESEND_API_KEY");
  });

  it("no leftover {{projectName}} in any file", () => {
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

// ─── Module combination matrix ──────────────────────────────
// Test that every meaningful combination scaffolds without errors

const MODULE_COMBOS: { name: string; modules: ModuleName[]; db?: boolean }[] = [
  { name: "empty", modules: [] },
  { name: "db-only", modules: ["db"], db: true },
  { name: "auth-only (auto-adds db)", modules: ["auth"], db: true },
  { name: "native-only", modules: ["native"] },
  { name: "mail-only", modules: ["mail"] },
  { name: "db+auth", modules: ["db", "auth"], db: true },
  { name: "db+native", modules: ["db", "native"], db: true },
  { name: "db+mail", modules: ["db", "mail"], db: true },
  { name: "auth+native", modules: ["auth", "native"], db: true },
  { name: "auth+mail", modules: ["auth", "mail"], db: true },
  { name: "native+mail", modules: ["native", "mail"] },
  { name: "db+auth+native", modules: ["db", "auth", "native"], db: true },
  { name: "db+auth+mail", modules: ["db", "auth", "mail"], db: true },
  { name: "db+native+mail", modules: ["db", "native", "mail"], db: true },
  { name: "auth+native+mail", modules: ["auth", "native", "mail"], db: true },
  { name: "all", modules: ["db", "auth", "native", "mail"], db: true },
];

describe.each(MODULE_COMBOS)("combo: $name", ({ name, modules, db }) => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = createTempDir(`combo-${name}`);
    scaffoldProject(
      projectDir,
      makeOptions({
        projectName: `test-${name}`,
        modules,
        ...(db
          ? { database: "postgres" as const, provider: "neon" as const }
          : {}),
      })
    );
  });

  afterAll(() => fs.removeSync(projectDir));

  it("scaffolds without errors and creates base structure", () => {
    expect(fs.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "apps/web/package.json"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(projectDir, "packages/api/src/trpc.ts"))
    ).toBeTruthy();
  });

  it("has no leftover {{projectName}} placeholders", () => {
    const trpc = fs.readFileSync(
      path.join(projectDir, "packages/api/src/trpc.ts"),
      "utf8"
    );
    expect(trpc).not.toContain("{{projectName}}");

    const rootPkg = fs.readJsonSync(path.join(projectDir, "package.json"));
    expect(rootPkg.name).toBe(`test-${name}`);
  });
});
