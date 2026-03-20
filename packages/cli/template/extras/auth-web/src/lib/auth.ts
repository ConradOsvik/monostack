import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@{{projectName}}/auth";

export const getSession = createServerFn({ method: "GET" }).handler(() => {
  const headers = getRequestHeaders();
  return auth.api.getSession({ headers });
});
