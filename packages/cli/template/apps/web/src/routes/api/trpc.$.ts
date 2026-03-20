import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@{{projectName}}/api";
import { createTRPCContext } from "@{{projectName}}/api/trpc";

export const Route = createFileRoute("/api/trpc/$")({
  server: {
    handlers: {
      GET: ({ request }) =>
        fetchRequestHandler({
          endpoint: "/api/trpc",
          req: request,
          router: appRouter,
          createContext: createTRPCContext,
        }),
      POST: ({ request }) =>
        fetchRequestHandler({
          endpoint: "/api/trpc",
          req: request,
          router: appRouter,
          createContext: createTRPCContext,
        }),
    },
  },
});
