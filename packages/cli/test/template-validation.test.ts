/**
 * Template validation tests.
 *
 * Scaffolds projects and validates the output is internally consistent:
 * 1. Every TS/TSX import has a matching dependency in the nearest package.json
 * 2. Every tsconfig.json "extends" has a matching devDependency
 * 3. Every workspace:* dep points to a package/app that exists
 * 4. No leftover {{placeholder}} tokens in any file
 * 5. All JSON files are valid JSON
 * 6. All TS/TSX files have valid syntax (no obvious breaks)
 */
import path from "node:path";

import { execa } from "execa";
import fs from "fs-extra";

import type { ModuleName } from "../src/constants";
import {
  createTempDir,
  getAllFiles,
  makeOptions,
  scaffoldProject,
} from "./helpers";

// ─── Validation engine ──────────────────────────────────────

interface Issue {
  file: string;
  message: string;
}

/**
 * Extract all import specifiers from a TypeScript file.
 */
function extractImports(content: string): string[] {
  const imports: string[] = [];
  const patterns = [
    /(?:import|export)\s+.*?\s+from\s+["']([^"']+)["']/g,
    /import\s+["']([^"']+)["']/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      imports.push(match[1]!);
    }
  }
  return [...new Set(imports)];
}

/**
 * Resolve npm package name from import specifier.
 * "@foo/bar/baz" → "@foo/bar", "react" → "react", "./x" → null
 */
function getPackageName(specifier: string): string | null {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    return `${parts[0]}/${parts[1]}`;
  }
  return specifier.split("/")[0]!;
}

/**
 * Find the nearest package.json for a file.
 */
function findPackageJson(filePath: string, projectRoot: string): string | null {
  let dir = path.dirname(filePath);
  while (dir.startsWith(projectRoot)) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) return pkgPath;
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * Get all deps + devDeps from a package.json.
 */
function getAllDeps(pkgJsonPath: string): Set<string> {
  const pkg = fs.readJsonSync(pkgJsonPath);
  const deps = new Set<string>();
  for (const key of ["dependencies", "devDependencies", "peerDependencies"]) {
    if (pkg[key]) {
      for (const dep of Object.keys(pkg[key])) {
        deps.add(dep);
      }
    }
  }
  return deps;
}

const NODE_BUILTINS = new Set([
  "node:path",
  "node:fs",
  "node:crypto",
  "node:url",
  "node:os",
  "node:child_process",
  "node:stream",
  "node:util",
  "node:http",
  "node:https",
  "node:net",
  "node:events",
  "node:buffer",
  "node:process",
  "node:internal/async_local_storage/async_context_frame",
  "path",
  "fs",
  "crypto",
  "url",
  "os",
]);

/**
 * Run all validations on a scaffolded project. Returns a list of issues.
 */
function validateProject(projectDir: string): Issue[] {
  const issues: Issue[] = [];
  const files = getAllFiles(projectDir);

  // ── 1. TS/TSX import validation ──────────────────────────
  for (const file of files) {
    const ext = path.extname(file);
    if (![".ts", ".tsx"].includes(ext)) continue;
    if (file.includes("routeTree.gen")) continue;

    const content = fs.readFileSync(file, "utf8");
    const imports = extractImports(content);
    const pkgJsonPath = findPackageJson(file, projectDir);
    if (!pkgJsonPath) continue;

    const deps = getAllDeps(pkgJsonPath);
    const rel = path.relative(projectDir, file);

    for (const specifier of imports) {
      if (specifier.includes("?")) continue; // CSS ?url imports
      const packageName = getPackageName(specifier);
      if (!packageName) continue;
      if (NODE_BUILTINS.has(specifier) || NODE_BUILTINS.has(packageName))
        continue;

      if (!deps.has(packageName)) {
        issues.push({
          file: rel,
          message: `imports "${specifier}" but "${packageName}" is not in ${path.relative(projectDir, pkgJsonPath)} dependencies`,
        });
      }
    }
  }

  // ── 2. tsconfig.json "extends" validation ────────────────
  for (const file of files) {
    if (!file.endsWith("tsconfig.json")) continue;

    const content = fs.readJsonSync(file);
    if (!content.extends) continue;

    const extendsValue = content.extends as string;
    const rel = path.relative(projectDir, file);

    // Skip relative extends and external packages like "expo/tsconfig.base"
    if (extendsValue.startsWith(".") || extendsValue.startsWith("/")) continue;

    const packageName = getPackageName(extendsValue);
    if (!packageName) continue;

    // Check this package is in the nearest package.json's deps
    const pkgJsonPath = findPackageJson(file, projectDir);
    if (!pkgJsonPath) continue;

    const deps = getAllDeps(pkgJsonPath);
    if (!deps.has(packageName)) {
      issues.push({
        file: rel,
        message: `extends "${extendsValue}" but "${packageName}" is not in ${path.relative(projectDir, pkgJsonPath)} dependencies`,
      });
    }

    // Verify the extends path resolves to an actual file in the project
    // e.g., "@app/config/tsconfig/base" → packages/config/tsconfig/base.json
    if (packageName.startsWith("@")) {
      const shortName = packageName.replace(/^@[^/]+\//, "");
      const subpath = extendsValue.replace(packageName, "");
      const configDir = path.join(projectDir, "packages", shortName);
      if (fs.existsSync(configDir)) {
        const resolvedPath = path.join(configDir, subpath + ".json");
        if (!fs.existsSync(resolvedPath)) {
          issues.push({
            file: rel,
            message: `extends "${extendsValue}" but resolved path "${path.relative(projectDir, resolvedPath)}" does not exist`,
          });
        }
      }
    }
  }

  // ── 3. workspace:* dep validation ────────────────────────
  for (const file of files) {
    if (!file.endsWith("package.json")) continue;

    const pkg = fs.readJsonSync(file);
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    } as Record<string, string>;
    const rel = path.relative(projectDir, file);

    for (const [name, version] of Object.entries(allDeps)) {
      if (version !== "workspace:*") continue;

      const shortName = name.replace(/^@[^/]+\//, "");
      const pkgDir = path.join(projectDir, "packages", shortName);
      const appDir = path.join(projectDir, "apps", shortName);

      if (!fs.existsSync(pkgDir) && !fs.existsSync(appDir)) {
        issues.push({
          file: rel,
          message: `depends on "${name}: workspace:*" but no matching package/app directory exists`,
        });
      }
    }
  }

  // ── 4. Leftover {{placeholder}} tokens ───────────────────
  for (const file of files) {
    const ext = path.extname(file);
    if (![".ts", ".tsx", ".json", ".js", ".md", ".css"].includes(ext)) continue;

    const content = fs.readFileSync(file, "utf8");
    const matches = content.match(/\{\{[a-zA-Z]+\}\}/g);
    if (matches) {
      issues.push({
        file: path.relative(projectDir, file),
        message: `contains unresolved placeholder(s): ${[...new Set(matches)].join(", ")}`,
      });
    }
  }

  // ── 5. JSON validity ─────────────────────────────────────
  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    try {
      fs.readJsonSync(file);
    } catch (e: any) {
      issues.push({
        file: path.relative(projectDir, file),
        message: `invalid JSON: ${e.message}`,
      });
    }
  }

  // ── 6. Basic TS syntax checks ────────────────────────────
  for (const file of files) {
    const ext = path.extname(file);
    if (![".ts", ".tsx"].includes(ext)) continue;

    const content = fs.readFileSync(file, "utf8");
    const rel = path.relative(projectDir, file);

    // Check for unbalanced braces (very basic)
    const opens = (content.match(/\{/g) || []).length;
    const closes = (content.match(/\}/g) || []).length;
    if (opens !== closes) {
      issues.push({
        file: rel,
        message: `unbalanced braces: ${opens} opening vs ${closes} closing`,
      });
    }

    // Check for empty imports (sign of broken template)
    if (/import\s+\{\s*\}\s+from/.test(content)) {
      issues.push({
        file: rel,
        message: `has empty import (import {} from ...)`,
      });
    }
  }

  return issues;
}

function formatIssues(issues: Issue[]): string {
  return issues.map((i) => `  ${i.file}\n    ${i.message}`).join("\n\n");
}

// ─── Test suites ────────────────────────────────────────────

const SCAFFOLDS: {
  name: string;
  modules: ModuleName[];
  database?: "postgres" | "mysql" | "sqlite";
  provider?: string;
}[] = [
  { name: "bare", modules: [] },
  {
    name: "db-postgres-neon",
    modules: ["db"],
    database: "postgres",
    provider: "neon",
  },
  {
    name: "db-sqlite-turso",
    modules: ["db"],
    database: "sqlite",
    provider: "turso",
  },
  {
    name: "db-mysql-planetscale",
    modules: ["db"],
    database: "mysql",
    provider: "planetscale",
  },
  {
    name: "auth-db",
    modules: ["db", "auth"],
    database: "postgres",
    provider: "neon",
  },
  { name: "native-only", modules: ["native"] },
  { name: "mail-only", modules: ["mail"] },
  {
    name: "native-auth",
    modules: ["db", "auth", "native"],
    database: "postgres",
    provider: "neon",
  },
  {
    name: "all-modules",
    modules: ["db", "auth", "native", "mail"],
    database: "postgres",
    provider: "neon",
  },
];

describe.each(SCAFFOLDS)(
  "template validation: $name",
  ({ name, modules, database, provider }) => {
    let projectDir: string;

    beforeAll(() => {
      projectDir = createTempDir(`validate-${name}`);
      scaffoldProject(
        projectDir,
        makeOptions({
          projectName: `val-${name}`,
          modules,
          database: (database as any) ?? null,
          provider: (provider as any) ?? null,
        })
      );
    });

    afterAll(() => fs.removeSync(projectDir));

    it("passes all validation checks", () => {
      const issues = validateProject(projectDir);
      if (issues.length > 0) {
        throw new Error(
          `Found ${issues.length} issue(s):\n\n${formatIssues(issues)}`
        );
      }
    });

    it("passes oxlint without errors", async () => {
      try {
        await execa("npx", ["oxlint", "."], {
          cwd: projectDir,
          stdio: "pipe",
        });
      } catch (e: any) {
        const output = e.stdout || e.stderr || e.message;
        const errorLines = output
          .split("\n")
          .filter(
            (l: string) =>
              l.includes("×") ||
              l.includes("╭") ||
              l.includes("│") ||
              l.includes("help:")
          )
          .join("\n");
        throw new Error(`oxlint found errors:\n\n${errorLines}`);
      }
    });

    it("passes oxfmt format check", async () => {
      try {
        await execa("npx", ["oxfmt", "--check", "."], {
          cwd: projectDir,
          stdio: "pipe",
        });
      } catch (e: any) {
        const output = e.stdout || e.stderr || e.message;
        throw new Error(`oxfmt found formatting issues:\n\n${output}`);
      }
    });
  }
);

// ─── Unit tests for helpers ─────────────────────────────────

describe("extractImports", () => {
  it("extracts named imports", () => {
    const imports = extractImports(
      `import { foo } from "@app/bar";\nimport { baz } from "react";`
    );
    expect(imports).toContain("@app/bar");
    expect(imports).toContain("react");
  });

  it("extracts default imports", () => {
    expect(extractImports(`import React from "react";`)).toContain("react");
  });

  it("extracts type imports", () => {
    expect(extractImports(`import type { Foo } from "@app/types";`)).toContain(
      "@app/types"
    );
  });

  it("extracts re-exports", () => {
    expect(
      extractImports(`export { WelcomeEmail } from "./welcome";`)
    ).toContain("./welcome");
  });

  it("extracts subpath imports", () => {
    expect(
      extractImports(
        `import { drizzleAdapter } from "better-auth/adapters/drizzle";`
      )
    ).toContain("better-auth/adapters/drizzle");
  });

  it("deduplicates", () => {
    const imports = extractImports(
      `import { a } from "react";\nimport { b } from "react";`
    );
    expect(imports.filter((i) => i === "react")).toHaveLength(1);
  });
});

describe("getPackageName", () => {
  it("handles scoped packages", () => {
    expect(getPackageName("@tanstack/react-router")).toBe(
      "@tanstack/react-router"
    );
  });

  it("handles scoped with subpath", () => {
    expect(getPackageName("@trpc/server/adapters/fetch")).toBe("@trpc/server");
  });

  it("handles unscoped", () => {
    expect(getPackageName("react")).toBe("react");
  });

  it("handles unscoped with subpath", () => {
    expect(getPackageName("better-auth/adapters/drizzle")).toBe("better-auth");
  });

  it("returns null for relative", () => {
    expect(getPackageName("./foo")).toBeNull();
    expect(getPackageName("../bar")).toBeNull();
  });
});
