import { httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@{{projectName}}/api";
import superjson from "superjson";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export function getTRPCLinks() {
  return [
    httpBatchLink({
      transformer: superjson,
      url: "/api/trpc",
    }),
  ];
}
