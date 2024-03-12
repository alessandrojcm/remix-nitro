import { eventHandler, toWebRequest } from "h3";
// eslint-disable-next-line import/no-unresolved,@typescript-eslint/ban-ts-comment
// @ts-expect-error
// eslint-disable-next-line import/no-unresolved
import { createRequestHandler } from "@remix-run/node";
import { createServer } from "vite";

export default eventHandler(async (event) => {
  const vite = await createServer({
    server: {
      middlewareMode: true,
    },
  });
  const mode = import.meta.env.DEV ? "development" : "production";
  const handler = createRequestHandler({
    build: await vite.ssrLoadModule("virtual:remix/server-build"),
    mode,
  });
  return handler(toWebRequest(event));
});
