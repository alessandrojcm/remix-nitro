import { eventHandler, toWebRequest } from "h3";
import { createRequestHandler } from "@remix-run/node";

export default eventHandler(async (event) => {
  const handler = createRequestHandler({
    build: await import("build/client"),
    mode: "production",
  });
  return handler(toWebRequest(event));
});
