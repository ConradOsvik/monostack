import fs from "fs-extra";

import { DEPENDENCY_VERSIONS } from "../constants.js";

type DepType = "dependencies" | "devDependencies";

/**
 * Add one or more packages to a package.json file.
 * Versions are looked up from the central version map.
 */
export function addPackageDependency(
  pkgJsonPath: string,
  deps: {
    dependencies?: (keyof typeof DEPENDENCY_VERSIONS)[];
    devDependencies?: (keyof typeof DEPENDENCY_VERSIONS)[];
  }
): void {
  const pkgJson = fs.readJsonSync(pkgJsonPath);

  const add = (list: (keyof typeof DEPENDENCY_VERSIONS)[], type: DepType) => {
    if (!pkgJson[type]) {
      pkgJson[type] = {};
    }
    for (const dep of list) {
      pkgJson[type][dep] = DEPENDENCY_VERSIONS[dep];
    }
    // Sort alphabetically
    pkgJson[type] = Object.fromEntries(
      Object.entries(pkgJson[type] as Record<string, string>).toSorted(
        ([a], [b]) => a.localeCompare(b)
      )
    );
  };

  if (deps.dependencies) {
    add(deps.dependencies, "dependencies");
  }
  if (deps.devDependencies) {
    add(deps.devDependencies, "devDependencies");
  }

  fs.writeJsonSync(pkgJsonPath, pkgJson, { spaces: 2 });
}

/**
 * Read and update a package.json.
 */
export function updatePackageJson(
  pkgJsonPath: string,
  updater: (pkg: Record<string, unknown>) => void
): void {
  const pkg = fs.readJsonSync(pkgJsonPath);
  updater(pkg);
  fs.writeJsonSync(pkgJsonPath, pkg, { spaces: 2 });
}

/**
 * Merge JSON content into an existing JSON file.
 */
export function mergeJsonFile(
  filePath: string,
  data: Record<string, unknown>
): void {
  const existing = fs.existsSync(filePath) ? fs.readJsonSync(filePath) : {};
  const merged = deepMerge(existing, data);
  fs.writeJsonSync(filePath, merged, { spaces: 2 });
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (isPlainObject(result[key]) && isPlainObject(source[key])) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}
