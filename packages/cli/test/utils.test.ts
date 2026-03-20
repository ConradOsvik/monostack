import path from "node:path";

import fs from "fs-extra";

import { addEnvVars, addEnvExampleVars } from "../src/utils/autowire";
import { addPackageDependency } from "../src/utils/deps";
import { copyTemplateDir } from "../src/utils/fs";
import { createTempDir } from "./helpers";

// ─── copyTemplateDir ────────────────────────────────────────

describe("copyTemplateDir", () => {
  it("renames _gitignore to .gitignore", () => {
    const src = createTempDir("copy-gitignore-src");
    const dest = createTempDir("copy-gitignore-dest");
    fs.writeFileSync(path.join(src, "_gitignore"), "node_modules");
    copyTemplateDir(src, dest);
    expect(fs.existsSync(path.join(dest, ".gitignore"))).toBeTruthy();
    expect(fs.existsSync(path.join(dest, "_gitignore"))).toBeFalsy();
    fs.removeSync(src);
    fs.removeSync(dest);
  });

  it("renames _env.example to .env.example", () => {
    const src = createTempDir("copy-env-src");
    const dest = createTempDir("copy-env-dest");
    fs.writeFileSync(path.join(src, "_env.example"), "SECRET=");
    copyTemplateDir(src, dest);
    expect(fs.existsSync(path.join(dest, ".env.example"))).toBeTruthy();
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

  it("does NOT rename _layout.tsx (Expo Router file)", () => {
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

  it("copies nested directories recursively", () => {
    const src = createTempDir("copy-nested-src");
    const dest = createTempDir("copy-nested-dest");
    fs.ensureDirSync(path.join(src, "a/b"));
    fs.writeFileSync(path.join(src, "a/b/deep.ts"), "export const x = 1;");
    copyTemplateDir(src, dest);
    expect(fs.existsSync(path.join(dest, "a/b/deep.ts"))).toBeTruthy();
    fs.removeSync(src);
    fs.removeSync(dest);
  });
});

// ─── addPackageDependency ───────────────────────────────────

describe("addPackageDependency", () => {
  it("adds sorted dependencies to package.json", () => {
    const dir = createTempDir("deps-sorted");
    const pkgPath = path.join(dir, "package.json");
    fs.writeJsonSync(pkgPath, { dependencies: {}, name: "test" });

    addPackageDependency(pkgPath, {
      dependencies: ["zod", "@trpc/server"],
    });

    const pkg = fs.readJsonSync(pkgPath);
    const keys = Object.keys(pkg.dependencies);
    expect(keys[0]).toBe("@trpc/server");
    expect(keys[1]).toBe("zod");
    fs.removeSync(dir);
  });

  it("creates dependencies key if missing", () => {
    const dir = createTempDir("deps-create");
    const pkgPath = path.join(dir, "package.json");
    fs.writeJsonSync(pkgPath, { name: "test" });

    addPackageDependency(pkgPath, { dependencies: ["zod"] });

    const pkg = fs.readJsonSync(pkgPath);
    expect(pkg.dependencies["zod"]).toBeDefined();
    fs.removeSync(dir);
  });

  it("adds devDependencies separately", () => {
    const dir = createTempDir("deps-dev");
    const pkgPath = path.join(dir, "package.json");
    fs.writeJsonSync(pkgPath, { name: "test" });

    addPackageDependency(pkgPath, {
      dependencies: ["drizzle-orm"],
      devDependencies: ["drizzle-kit"],
    });

    const pkg = fs.readJsonSync(pkgPath);
    expect(pkg.dependencies["drizzle-orm"]).toBeDefined();
    expect(pkg.devDependencies["drizzle-kit"]).toBeDefined();
    fs.removeSync(dir);
  });
});

// ─── addEnvVars ─────────────────────────────────────────────

describe("addEnvVars", () => {
  it("inserts env vars before the closing of the server block", () => {
    const dir = createTempDir("env-vars");
    const filePath = path.join(dir, "server.ts");
    fs.writeFileSync(
      filePath,
      `import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  emptyStringAsUndefined: true,
  runtimeEnv: process.env,
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
});
`
    );

    addEnvVars(filePath, { DATABASE_URL: "z.string().min(1)" });

    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain("DATABASE_URL: z.string().min(1)");
    expect(content).toContain("NODE_ENV");
    fs.removeSync(dir);
  });

  it("skips vars that already exist", () => {
    const dir = createTempDir("env-vars-skip");
    const filePath = path.join(dir, "server.ts");
    const original = `  server: {
    DATABASE_URL: z.string().min(1),
  },`;
    fs.writeFileSync(filePath, original);

    addEnvVars(filePath, { DATABASE_URL: "z.string().min(1)" });

    const content = fs.readFileSync(filePath, "utf8");
    // Should not have duplicated
    const count = (content.match(/DATABASE_URL/g) || []).length;
    expect(count).toBe(1);
    fs.removeSync(dir);
  });

  it("can add multiple vars", () => {
    const dir = createTempDir("env-vars-multi");
    const filePath = path.join(dir, "server.ts");
    fs.writeFileSync(
      filePath,
      `  server: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },`
    );

    addEnvVars(filePath, {
      DATABASE_URL: "z.string().min(1)",
      RESEND_API_KEY: "z.string().min(1)",
    });

    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain("DATABASE_URL");
    expect(content).toContain("RESEND_API_KEY");
    fs.removeSync(dir);
  });
});

// ─── addEnvExampleVars ──────────────────────────────────────

describe("addEnvExampleVars", () => {
  it("appends lines to .env.example", () => {
    const dir = createTempDir("env-example");
    const filePath = path.join(dir, ".env.example");
    fs.writeFileSync(filePath, "NODE_ENV=development\n");

    addEnvExampleVars(filePath, ["DATABASE_URL=", "RESEND_API_KEY="]);

    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain("DATABASE_URL=");
    expect(content).toContain("RESEND_API_KEY=");
    fs.removeSync(dir);
  });

  it("skips lines where the key already exists", () => {
    const dir = createTempDir("env-example-skip");
    const filePath = path.join(dir, ".env.example");
    fs.writeFileSync(filePath, "DATABASE_URL=postgres://localhost\n");

    addEnvExampleVars(filePath, ["DATABASE_URL=new-value"]);

    const content = fs.readFileSync(filePath, "utf8");
    const count = (content.match(/DATABASE_URL/g) || []).length;
    expect(count).toBe(1);
    fs.removeSync(dir);
  });
});
