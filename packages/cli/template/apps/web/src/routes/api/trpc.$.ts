import { createAPIFileRoute } from "@tanstack/react-start/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@{{projectName}}/api";
import { createTRPCContext } from "@{{projectName}}/api/trpc";

export const APIRoute = createAPIFileRoute("/api/trpc/$")({
  GET: async ({ request }) =>
    fetchRequestHandler({
      endpoint: "/api/trpc",
      req: request,
      router: appRouter,
      createContext: createTRPCContext,
    }),
  POST: async ({ request }) =>
    fetchRequestHandler({
      endpoint: "/api/trpc",
      req: request,
      router: appRouter,
      createContext: createTRPCContext,
    }),
});
