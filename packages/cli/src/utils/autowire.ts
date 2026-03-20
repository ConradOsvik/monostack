import crypto from "node:crypto";
import path from "node:path";

import * as p from "@clack/prompts";
import fs from "fs-extra";
import pc from "picocolors";

import type { ModuleName } from "../constants.js";
import type { AddContext } from "../modules/index.js";
import { copyTemplateDir, interpolateFile } from "./fs.js";

// ─── tRPC variant management ────────────────────────────────

/**
 * Map of module-state keys to template paths for trpc.ts.
 * The key is a sorted, "+"-joined set of relevant modules.
 */
const TRPC_VARIANT_DIRS: Record<string, string> = {
  base: "packages/api",
  db: "extras/db-api",
  auth: "extras/auth-api",
  "auth+db": "extras/auth-db-api",
};

/**
 * Compute the variant key based on which modules affect trpc.ts.
 */
function getTrpcVariantKey(modules: ModuleName[]): string {
  const relevant = modules.filter((m) => m === "db" || m === "auth").sort();
  return relevant.length === 0 ? "base" : relevant.join("+");
}

/**
 * Hash file content for comparison (normalized).
 */
function hashContent(content: string): string {
  const normalized = content
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Apply the correct trpc.ts variant based on all installed modules.
 * Used by the `add` command to re-wire trpc.ts after adding a module.
 */
export async function applyTrpcVariant(ctx: AddContext): Promise<void> {
  const { projectDir, templateDir, force } = ctx;

  // Compute target state = installed + what we're adding
  const allModules = [
    ...new Set([...ctx.installedModules, ...ctx.options.modules]),
  ];
  const variantKey = getTrpcVariantKey(allModules);
  const variantDir = TRPC_VARIANT_DIRS[variantKey];
  if (!variantDir) return;

  const trpcTargetPath = path.join(projectDir, "packages/api/src/trpc.ts");
  const trpcTemplatePath = path.join(templateDir, variantDir, "src/trpc.ts");

  if (!fs.existsSync(trpcTemplatePath)) return;

  // Read proposed new content and interpolate project name
  const projectName = readProjectName(projectDir);
  let newContent = fs.readFileSync(trpcTemplatePath, "utf8");
  newContent = newContent.replaceAll("{{projectName}}", projectName);

  // Check if current file matches any known variant (safe to replace)
  if (fs.existsSync(trpcTargetPath)) {
    const currentContent = fs.readFileSync(trpcTargetPath, "utf8");
    const currentHash = hashContent(currentContent);

    // Check against all known variants
    const isKnownVariant = Object.values(TRPC_VARIANT_DIRS).some((dir) => {
      const tplPath = path.join(templateDir, dir, "src/trpc.ts");
      if (!fs.existsSync(tplPath)) return false;
      let tplContent = fs.readFileSync(tplPath, "utf8");
      tplContent = tplContent.replaceAll("{{projectName}}", projectName);
      return hashContent(tplContent) === currentHash;
    });

    if (!isKnownVariant && !force) {
      // File has been customized — prompt user
      const action = await p.select({
        message: `${pc.yellow("packages/api/src/trpc.ts")} has been modified. How should we handle it?`,
        options: [
          {
            label: "Write as trpc.ts.monostack-new (merge manually)",
            value: "side-by-side",
          },
          {
            label: "Overwrite (your changes will be lost)",
            value: "overwrite",
          },
          { label: "Skip (wire manually)", value: "skip" },
        ],
      });

      if (p.isCancel(action) || action === "skip") {
        return;
      }

      if (action === "side-by-side") {
        fs.writeFileSync(
          path.join(projectDir, "packages/api/src/trpc.ts.monostack-new"),
          newContent,
          "utf8"
        );
        p.log.warn(
          `Wrote ${pc.cyan("trpc.ts.monostack-new")} — merge your changes manually.`
        );
        return;
      }
      // "overwrite" falls through to write below
    }
  }

  fs.writeFileSync(trpcTargetPath, newContent, "utf8");
}

/**
 * Apply the correct trpc.ts variant during greenfield `create` scaffold.
 * No conflict detection needed since we know the exact state.
 */
export function applyTrpcVariantSync(
  projectDir: string,
  templateDir: string,
  modules: ModuleName[]
): void {
  const variantKey = getTrpcVariantKey(modules);

  // "base" variant is already copied as part of the packages/api template,
  // so we only need to overwrite if we need a different variant.
  if (variantKey === "base") return;

  const variantDir = TRPC_VARIANT_DIRS[variantKey];
  if (!variantDir) return;

  const variantTemplatePath = path.join(templateDir, variantDir);
  if (fs.existsSync(variantTemplatePath)) {
    copyTemplateDir(variantTemplatePath, path.join(projectDir, "packages/api"));
  }
}

// ─── Env var management (additive) ──────────────────────────

/**
 * Add environment variables to a t3-env server.ts file.
 * Inserts before the closing `},` of the `server: {` block.
 */
export function addEnvVars(
  filePath: string,
  vars: Record<string, string>
): void {
  let content = fs.readFileSync(filePath, "utf8");

  for (const [key, schema] of Object.entries(vars)) {
    // Skip if already present
    if (content.includes(key)) continue;

    // Find the closing of the server block: line with just `},` or `  },`
    // We insert before the last entry's closing
    const serverBlockEnd = content.lastIndexOf("  },");
    if (serverBlockEnd === -1) continue;

    const insertion = `    ${key}: ${schema},\n`;
    content =
      content.slice(0, serverBlockEnd) +
      insertion +
      content.slice(serverBlockEnd);
  }

  fs.writeFileSync(filePath, content, "utf8");
}

/**
 * Add lines to .env.example if not already present.
 */
export function addEnvExampleVars(filePath: string, lines: string[]): void {
  let content = fs.readFileSync(filePath, "utf8");

  for (const line of lines) {
    const key = line.split("=")[0];
    if (content.includes(key!)) continue;
    if (!content.endsWith("\n")) content += "\n";
    content += line + "\n";
  }

  fs.writeFileSync(filePath, content, "utf8");
}

// ─── Project root detection ─────────────────────────────────

/**
 * Find the monostack project root by walking up from cwd
 * looking for turbo.json.
 */
export function findProjectRoot(
  startDir: string = process.cwd()
): string | null {
  let dir = path.resolve(startDir);
  const { root } = path.parse(dir);

  while (dir !== root) {
    if (
      fs.existsSync(path.join(dir, "turbo.json")) &&
      fs.existsSync(path.join(dir, "package.json"))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  return null;
}

/**
 * Read the project name from the root package.json.
 */
export function readProjectName(projectDir: string): string {
  const pkg = fs.readJsonSync(path.join(projectDir, "package.json"));
  return pkg.name as string;
}
