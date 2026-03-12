import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

export const { signIn, signUp, signOut, useSession } = authClient;
