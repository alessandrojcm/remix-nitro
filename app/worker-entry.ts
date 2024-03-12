import { eventHandler, toWebRequest } from "h3";
// eslint-disable-next-line import/no-unresolved,@typescript-eslint/ban-ts-comment
// @ts-expect-error
// eslint-disable-next-line import/no-unresolved
import * as build from "virtual:remix/server-build";
import { createRequestHandler } from "@remix-run/node";

export default eventHandler(async (event) => {
  const mode = import.meta.env.DEV ? "development" : "production";
  const handler = createRequestHandler(build, mode);
  return handler(toWebRequest(event));
});