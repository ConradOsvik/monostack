import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  client: {},
  clientPrefix: "EXPO_PUBLIC_",
  emptyStringAsUndefined: true,
  runtimeEnv: process.env,
});
