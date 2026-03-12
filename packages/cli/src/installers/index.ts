import type { ProjectOptions } from "../constants.js";

export interface InstallerContext {
  projectDir: string;
  templateDir: string;
  options: ProjectOptions;
}

export type Installer = (ctx: InstallerContext) => void;

export { dbDrizzleInstaller } from "./db-drizzle.js";
export { dbPrismaInstaller } from "./db-prisma.js";
export { authInstaller } from "./auth.js";
