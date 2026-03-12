import { appRouter } from "./root";
import { createCallerFactory } from "./trpc";

const createCaller = createCallerFactory(appRouter);

export const createServerCaller = async () => createCaller({});
