import path from "node:path";

import fs from "fs-extra";

/** Files that should be renamed from `_name` to `.name` on copy. */
const DOTFILE_RENAMES = new Set([
  "_gitignore",
  "_env",
  "_env.example",
  "_env.local",
  "_npmrc",
  "_eslintrc.json",
  "_prettierrc",
  "_oxlintrc.json",
  "_oxfmtrc.jsonc",
]);

/**
 * Recursively copy a directory, renaming known dotfiles from `_` prefix to `.`.
 * (e.g., `_gitignore` → `.gitignore`, `_env.example` → `.env.example`).
 * Files like `_layout.tsx` (Expo Router) are NOT renamed.
 */
export function copyTemplateDir(src: string, dest: string): void {
  fs.ensureDirSync(dest);

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destName = DOTFILE_RENAMES.has(entry.name)
      ? `.${entry.name.slice(1)}`
      : entry.name;
    const destPath = path.join(dest, destName);

    if (entry.isDirectory()) {
      copyTemplateDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Replace all `{{placeholder}}` tokens in a file.
 */
export function interpolateFile(
  filePath: string,
  replacements: Record<string, string>
): void {
  if (!fs.existsSync(filePath)) {
    return;
  }
  let content = fs.readFileSync(filePath, "utf8");
  for (const [key, value] of Object.entries(replacements)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  fs.writeFileSync(filePath, content, "utf8");
}

/**
 * Recursively interpolate all files in a directory.
 */
export function interpolateDir(
  dir: string,
  replacements: Record<string, string>
): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }
      interpolateDir(fullPath, replacements);
    } else {
      // Only interpolate text-like files
      const ext = path.extname(entry.name);
      const textExts = new Set([
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".json",
        ".md",
        ".css",
        ".html",
        ".yaml",
        ".yml",
        ".toml",
        ".env",
        ".example",
        "",
      ]);
      if (textExts.has(ext) || entry.name.startsWith(".")) {
        interpolateFile(fullPath, replacements);
      }
    }
  }
}
