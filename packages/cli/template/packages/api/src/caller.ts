import { appRouter } from "./root";
import { createCallerFactory } from "./trpc";

export const createCaller = createCallerFactory(appRouter);
