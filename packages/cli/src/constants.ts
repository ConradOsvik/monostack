export const DEFAULT_PROJECT_NAME = "my-app";

export type ModuleName = "db" | "auth" | "native" | "mail";

export type DatabaseType = "postgres" | "mysql" | "sqlite";
export type DatabaseProvider =
  | "neon"
  | "supabase"
  | "vercel-postgres"
  | "planetscale"
  | "turso"
  | "local";

export interface ProjectOptions {
  projectName: string;
  modules: ModuleName[];
  database: DatabaseType | null;
  provider: DatabaseProvider | null;
  git: boolean;
  install: boolean;
}

export const PROVIDER_MAP: Record<
  DatabaseType,
  { label: string; value: DatabaseProvider }[]
> = {
  mysql: [
    { label: "PlanetScale", value: "planetscale" },
    { label: "Local (connection string)", value: "local" },
  ],
  postgres: [
    { label: "Neon (serverless PostgreSQL)", value: "neon" },
    { label: "Supabase", value: "supabase" },
    { label: "Vercel Postgres", value: "vercel-postgres" },
    { label: "Local (connection string)", value: "local" },
  ],
  sqlite: [
    { label: "Turso (serverless SQLite)", value: "turso" },
    { label: "Local (file)", value: "local" },
  ],
};

/** Dependency version map — single source of truth */
export const DEPENDENCY_VERSIONS = {
  // TanStack
  "@tanstack/react-router": "^1.166.0",
  "@tanstack/react-start": "^1.166.0",
  "@tanstack/react-query": "^5.72.2",
  "@vitejs/plugin-react": "^4.4.1",
  "vite-tsconfig-paths": "^4.3.2",
  vite: "^6.3.1",

  // tRPC
  "@trpc/server": "^11.1.0",
  "@trpc/client": "^11.1.0",
  "@trpc/tanstack-react-query": "^11.1.0",
  superjson: "^2.2.2",
  zod: "^3.24.3",

  // Expo
  expo: "~52.0.46",
  "expo-router": "~4.0.20",
  "expo-constants": "~17.0.8",
  "expo-linking": "~7.0.8",
  "expo-status-bar": "~2.0.2",
  "react-native": "0.77.1",
  "react-native-screens": "~4.9.2",
  "react-native-safe-area-context": "~5.3.0",
  "react-native-web": "~0.19.13",

  // UniWind
  uniwind: "^1.0.0",

  // React
  react: "^19.1.0",
  "react-dom": "^19.1.0",

  // Tailwind CSS
  tailwindcss: "^4.1.3",
  "@tailwindcss/vite": "^4.1.3",

  // shadcn/ui essentials
  "class-variance-authority": "^0.7.1",
  clsx: "^2.1.1",
  "tailwind-merge": "^3.2.0",
  "lucide-react": "^0.474.0",

  // t3-env
  "@t3-oss/env-core": "^0.13.10",

  // Better Auth
  "better-auth": "^1.2.7",

  // Drizzle
  "drizzle-orm": "^0.44.1",
  "drizzle-kit": "^0.31.1",
  "@neondatabase/serverless": "^0.10.4",
  postgres: "^3.4.5",
  "@libsql/client": "^0.14.0",

  // Mail
  resend: "^4.1.2",
  "@react-email/components": "^0.0.36",
  "react-email": "^3.0.6",

  // Build / tooling
  typescript: "^5.8.2",
  "@types/react": "^19.1.0",
  "@types/react-dom": "^19.1.0",
  "@types/node": "^22.13.10",

  // Metro (Expo)
  "@expo/metro-config": "~0.19.11",
} as const;
