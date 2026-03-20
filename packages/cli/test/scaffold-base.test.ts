import path from "node:path";

import fs from "fs-extra";

import { createTempDir, makeOptions, scaffoldProject } from "./helpers";

describe("scaffold: bare (no modules)", () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = createTempDir("bare");
    scaffoldProject(projectDir, makeOptions({ projectName: "test-bare" }));
  });

  afterAll(() => fs.removeSync(projectDir));

  it("creates root config files", () => {
    for (const file of [
      "package.json",
      "turbo.json",
      ".gitignore",
      ".env.example",
      ".oxlintrc.json",
      ".oxfmtrc.jsonc",
      "README.md",
    ]) {
      expect(fs.existsSync(path.join(projectDir, file))).toBeTruthy();
    }
  });

  it("interpolates project name in root package.json", () => {
    const pkg = fs.readJsonSync(path.join(projectDir, "package.json"));
    expect(pkg.name).toBe("test-bare");
  });

  it("root package.json has catalog with shared deps", () => {
    const pkg = fs.readJsonSync(path.join(projectDir, "package.json"));
    expect(pkg.catalog).toBeDefined();
    expect(pkg.catalog.react).toBeDefined();
    expect(pkg.catalog.typescript).toBeDefined();
    expect(pkg.catalog.zod).toBeDefined();
  });

  it("creates web app with all expected files", () => {
    for (const file of [
      "apps/web/package.json",
      "apps/web/vite.config.ts",
      "apps/web/src/routes/__root.tsx",
      "apps/web/src/routes/index.tsx",
      "apps/web/src/routes/api/trpc.$.ts",
      "apps/web/src/lib/trpc.ts",
      "apps/web/src/lib/utils.ts",
    ]) {
      expect(fs.existsSync(path.join(projectDir, file))).toBeTruthy();
    }
  });

  it("web app uses vite scripts", () => {
    const pkg = fs.readJsonSync(path.join(projectDir, "apps/web/package.json"));
    expect(pkg.scripts.dev).toBe("vite dev");
    expect(pkg.scripts.build).toBe("vite build");
  });

  it("creates core packages (config, env, api)", () => {
    for (const file of [
      "packages/config/package.json",
      "packages/config/tsconfig/base.json",
      "packages/env/package.json",
      "packages/env/src/server.ts",
      "packages/api/package.json",
      "packages/api/src/trpc.ts",
      "packages/api/src/root.ts",
    ]) {
      expect(fs.existsSync(path.join(projectDir, file))).toBeTruthy();
    }
  });

  it("packages use catalog: references for shared deps", () => {
    const apiPkg = fs.readJsonSync(
      path.join(projectDir, "packages/api/package.json")
    );
    expect(apiPkg.dependencies["zod"]).toBe("catalog:");
    expect(apiPkg.dependencies["@trpc/server"]).toBe("catalog:");
  });

  it("interpolates workspace references in api package.json", () => {
    const pkg = fs.readJsonSync(
      path.join(projectDir, "packages/api/package.json")
    );
    expect(pkg.dependencies["@test-bare/env"]).toBe("workspace:*");
  });

  it("does NOT create native app (it is a module)", () => {
    expect(fs.existsSync(path.join(projectDir, "apps/native"))).toBeFalsy();
  });

  it("does NOT create db or auth packages", () => {
    expect(fs.existsSync(path.join(projectDir, "packages/db"))).toBeFalsy();
    expect(fs.existsSync(path.join(projectDir, "packages/auth"))).toBeFalsy();
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
