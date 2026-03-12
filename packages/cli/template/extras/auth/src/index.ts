import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: {
    type: "sqlite",
    url: process.env.DATABASE_URL, // Change based on your database
  },
  emailAndPassword: {
    enabled: true,
  },
});

export type Session = typeof auth.$Infer.Session;
