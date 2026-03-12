import { initTRPC } from "@trpc/server";
import { db } from "@{{projectName}}/db";
import superjson from "superjson";

export const createTRPCContext = async () => ({ db });

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const { router } = t;
export const publicProcedure = t.procedure;
export const { createCallerFactory } = t;
