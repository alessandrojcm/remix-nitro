import { eventHandler, toWebRequest } from "h3";
// eslint-disable-next-line import/no-unresolved,@typescript-eslint/ban-ts-comment
// @ts-expect-error
// eslint-disable-next-line import/no-unresolved
import * as build from "virtual:remix/server-build";
import { createRequestHandler } from "@remix-run/server-runtime";
import { runtimeContext } from "../plugin/shared";

export default eventHandler(async () => {
  const { event, runtime } = runtimeContext.use();
  const mode = import.meta.env.DEV ? "development" : "production";
  console.log("Event from the devHandler: ", event.context.message);
  const handler = createRequestHandler(build, mode);
  return handler(toWebRequest(event), {
    context: runtime.context,
  });
});
