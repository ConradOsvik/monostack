/**
 * Integration tests — scaffold a project, install deps, and typecheck.
 *
 * These catch real type errors that static analysis can't find:
 * missing @types packages, broken tsconfig extends, unresolvable imports, etc.
 *
 * Note: apps/web is excluded because TanStack Router generates routeTree.gen.ts
 * at dev time, and createFileRoute types depend on it. The web app can only be
 * typechecked after running `vite dev` once.
 */
import path from "node:path";

import { execa } from "execa";
import fs from "fs-extra";

import { createTempDir, makeOptions, scaffoldProject } from "./helpers";

async function scaffoldAndTypecheck(
  testName: string,
  options: ReturnType<typeof makeOptions>
): Promise<{ projectDir: string; errors: string[] }> {
  const projectDir = createTempDir(testName);
  scaffoldProject(projectDir, options);

  await execa("bun", ["install"], { cwd: projectDir, stdio: "pipe" });

  const errors: string[] = [];

  // apps/web is excluded — TanStack Router needs `vite dev` to generate routeTree.gen.ts
  // apps/native is excluded — Expo has its own build system
  const tsconfigDirs = [
    "packages/api",
    "packages/env",
    ...(options.modules.includes("db") ? ["packages/db"] : []),
    ...(options.modules.includes("auth") ? ["packages/auth"] : []),
    ...(options.modules.includes("mail") ? ["packages/mail"] : []),
  ];

  for (const dir of tsconfigDirs) {
    const fullDir = path.join(projectDir, dir);
    if (!fs.existsSync(path.join(fullDir, "tsconfig.json"))) continue;

    try {
      await execa("npx", ["tsc", "--noEmit"], {
        cwd: fullDir,
        stdio: "pipe",
      });
    } catch (e: any) {
      const output = e.stdout || e.stderr || e.message;
      errors.push(`${dir}:\n${output}`);
    }
  }

  return { projectDir, errors };
}

describe("integration: typecheck scaffolded projects", () => {
  it("bare project typechecks", async () => {
    const { projectDir, errors } = await scaffoldAndTypecheck(
      "int-bare",
      makeOptions({ projectName: "int-bare" })
    );
    if (errors.length > 0) {
      throw new Error(`TypeScript errors:\n\n${errors.join("\n\n")}`);
    }
    fs.removeSync(projectDir);
  }, 120_000);

  it("all modules project typechecks", async () => {
    const { projectDir, errors } = await scaffoldAndTypecheck(
      "int-full",
      makeOptions({
        projectName: "int-full",
        modules: ["db", "auth", "mail"],
        database: "postgres",
        provider: "neon",
      })
    );
    if (errors.length > 0) {
      throw new Error(`TypeScript errors:\n\n${errors.join("\n\n")}`);
    }
    fs.removeSync(projectDir);
  }, 120_000);
});
