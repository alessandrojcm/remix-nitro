import {
  exposeTinyRpc,
  httpClientAdapter,
  httpServerAdapter,
  proxyTinyRpc,
} from "@hiogawa/tiny-rpc";
import type { ClientRpc, ServerRpc } from "../server/plugin";
import { ESModulesRunner, ViteRuntime } from "vite/runtime";
import { type HMRPayload } from "vite";
import { CLIENT_RPC_PATH, SERVER_RPC_PATH } from "../shared";
import { getRequestURL, H3Event, toWebRequest } from "h3";
import { consola } from "consola";

interface Env {
  __VITE_NODE_DEBUG: boolean;
  __VITE_RUNTIME_ROOT: string;
  __VITE_RUNTIME_HMR: boolean;
  __WORKER_ENTRY: string;
}
// Heavily based on https://github.com/hi-ogawa/vite-plugins/blob/main/packages/vite-node-miniflare/src/client/worker-entry.ts
export default {
  async eventHandler(event: H3Event, env: Env) {
    try {
      const url = getRequestURL(event);
      const rendererResponse = await createRendererHandler({
        workerEntry: env.__WORKER_ENTRY,
        baseUrl: url.origin,
        root: env.__VITE_RUNTIME_ROOT,
        debug: env.__VITE_NODE_DEBUG,
        hmr: env.__VITE_RUNTIME_HMR,
      });
      return await rendererResponse(event, env);
    } catch (e) {
      consola.withTag("[remix-nitro-client]").error(e);
      let body = "[remix-nitro-client] error\n";
      if (e instanceof Error) {
        body += `${e.stack ?? e.message}`;
      }
      return new Response(body, { status: 500 });
    }
  },
};
type RendererHandler = (
  event: H3Event<Request>,
  env: Env
) => Response | PromiseLike<Response>;

async function createRendererHandler(options: {
  workerEntry: string;
  baseUrl: string;
  root: string;
  debug: boolean;
  hmr: boolean;
}) {
  // ServerRpc proxy
  const serverRpc = proxyTinyRpc<ServerRpc>({
    adapter: httpClientAdapter({ url: options.baseUrl + SERVER_RPC_PATH }),
  });
  await serverRpc.setupClient(options.baseUrl);
  const clientRpcHandler = exposeTinyRpc({
    adapter: httpServerAdapter({ endpoint: CLIENT_RPC_PATH }),
    routes: {
      async onUpdate(payload) {
        await customOnUpdateFn(onUpdateCallback, runtime, options)(payload);
      },
    } satisfies ClientRpc,
  });

  let onUpdateCallback!: OnUpdateFn;
  const runner = new ESModulesRunner();

  const runtime = new ViteRuntime(
    {
      root: options.root,
      fetchModule(id, importer) {
        return serverRpc.ssrFetchModule(id, importer);
      },
      sourcemapInterceptor: "prepareStackTrace",
      hmr: {
        connection: {
          isReady: () => true,
          onUpdate(callback) {
            onUpdateCallback = callback as any;
          },
          send(messages) {
            serverRpc.send(messages);
          },
        },
        logger: consola.withTag("vite-runtime"),
      },
    },
    runner
  );

  const fetchHandler: RendererHandler = async (event, env) => {
    const response = await clientRpcHandler({ request: toWebRequest(event) });
    if (response) {
      return response;
    }
    const workerEntry = await runtime.executeEntrypoint(options.workerEntry);
    const workerEnv = {
      ...env,
      __RPC: serverRpc, // extend for customRpc usage
    };
    return (workerEntry.default as RendererHandler)(event, workerEnv);
  };
  return fetchHandler;
}

type OnUpdateFn = (payload: HMRPayload) => Promise<void>;

function customOnUpdateFn(
  originalFn: OnUpdateFn,
  runtime: ViteRuntime,
  options: { debug: boolean; hmr: boolean }
): OnUpdateFn {
  return async (payload) => {
    if (options.debug) {
      consola.withTag("[remix-nitro-client]").log("HMRPayload:", payload);
    }
    // use simple module tree invalidation for non-hmr mode
    if (!options.hmr && payload.type === "update") {
      for (const update of payload.updates) {
        const invalidated = runtime.moduleCache.invalidateDepTree([
          update.path,
        ]);
        if (options.debug) {
          consola
            .withTag("[remix-nitro-client]")
            .log("invalidateDepTree:", [...invalidated]);
        }
      }
      return;
    }
    await originalFn(payload);
  };
}
