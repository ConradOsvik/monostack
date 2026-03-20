import type { ModuleName, ProjectOptions } from "../constants.js";
import { authModule } from "./auth.js";
import { dbModule } from "./db.js";
import { mailModule } from "./mail.js";
import { nativeModule } from "./native.js";

export interface InstallerContext {
  projectDir: string;
  templateDir: string;
  options: ProjectOptions;
}

export interface AddContext extends InstallerContext {
  installedModules: ModuleName[];
  force: boolean;
}

export interface ModuleDefinition {
  name: ModuleName;
  label: string;
  dependencies: ModuleName[];
  detect(projectDir: string): boolean;
  install(ctx: InstallerContext): void;
  add(ctx: AddContext): Promise<void>;
}

export const MODULES: Record<ModuleName, ModuleDefinition> = {
  db: dbModule,
  auth: authModule,
  native: nativeModule,
  mail: mailModule,
};

/**
 * Returns modules in dependency order (dependencies first).
 */
export function resolveModuleOrder(moduleNames: ModuleName[]): ModuleName[] {
  const ordered: ModuleName[] = [];
  const visited = new Set<ModuleName>();

  function visit(name: ModuleName) {
    if (visited.has(name)) return;
    visited.add(name);
    const mod = MODULES[name];
    for (const dep of mod.dependencies) {
      if (!visited.has(dep)) {
        // Auto-add dependency if not already in the list
        visit(dep);
      }
    }
    ordered.push(name);
  }

  for (const name of moduleNames) {
    visit(name);
  }

  return ordered;
}

/**
 * Detect which modules are currently installed in a project.
 */
export function detectInstalledModules(projectDir: string): ModuleName[] {
  const installed: ModuleName[] = [];
  for (const [name, mod] of Object.entries(MODULES)) {
    if (mod.detect(projectDir)) {
      installed.push(name as ModuleName);
    }
  }
  return installed;
}
