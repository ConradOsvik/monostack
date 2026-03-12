import { initTRPC, TRPCError } from "@trpc/server";
import { auth, type Session } from "@{{projectName}}/auth";
import superjson from "superjson";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth.api.getSession({
    headers: opts.headers,
  });

  return { session };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const { router } = t;
export const publicProcedure = t.procedure;
export const { createCallerFactory } = t;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: ctx.session as Session,
    },
  });
});
