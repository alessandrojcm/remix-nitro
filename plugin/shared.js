import { AsyncLocalStorage } from "node:async_hooks";
import { getContext } from "unctx";
export const CLIENT_RPC_PATH = "/__rpc_client";
export const SERVER_RPC_PATH = "/__rpc_server";
export const RUNTIME_CONTEXT = "nitro-dev-runtime-context";

export const runtimeContext = getContext(RUNTIME_CONTEXT, {
  asyncContext: true,
  AsyncLocalStorage,
});
