import { execa } from "execa";

export type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

export function detectPackageManager(): PackageManager {
  const ua = process.env.npm_config_user_agent;
  if (ua) {
    if (ua.startsWith("bun")) {
      return "bun";
    }
    if (ua.startsWith("pnpm")) {
      return "pnpm";
    }
    if (ua.startsWith("yarn")) {
      return "yarn";
    }
  }
  return "bun";
}

export async function installDependencies(
  cwd: string,
  pm: PackageManager
): Promise<void> {
  await execa(pm, ["install"], { cwd, stdio: "pipe" });
}

export function getRunCommand(pm: PackageManager): string {
  return pm === "npm" ? "npm run" : pm;
}
