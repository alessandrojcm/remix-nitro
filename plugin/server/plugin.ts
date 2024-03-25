import {
  type HMRPayload,
  type Plugin,
  ServerHMRConnector,
  type ViteDevServer,
} from "vite";
import { CLIENT_RPC_PATH, SERVER_RPC_PATH } from "../shared";

import {
  exposeTinyRpc,
  httpClientAdapter,
  httpServerAdapter,
  proxyTinyRpc,
  type TinyRpcProxy,
} from "@hiogawa/tiny-rpc";
import { createApp, eventHandler, toNodeListener, toWebRequest } from "h3";

export interface ServerRpc {
  ssrFetchModule: ViteDevServer["ssrFetchModule"];
  send: ServerHMRConnector["send"];
  transformIndexHtml: ViteDevServer["transformIndexHtml"];
  setupClient: (url: string) => void;
}

export interface ClientRpc {
  onUpdate: (payload: HMRPayload) => void;
}
// Based on https://github.com/hi-ogawa/vite-plugins/blob/main/packages/vite-node-miniflare/src/server/plugin.ts
export function vitePluginNitro(pluginOptions: {
  entry: string;
  debug?: boolean;
  hmr?: boolean; // for now disable ssr hmr by default for react plugin
  customRpc?: Record<string, Function>;
}): Plugin[] {
  return [
    {
      name: "nitro-plugin",
      apply: "serve",
      enforce: "post",
      async configureServer(server) {
        let clientRpc: TinyRpcProxy<ClientRpc> | undefined;
        const connector = new ServerHMRConnector(server);
        connector.onUpdate((payload) => {
          clientRpc?.onUpdate(payload);
        });

        const serverRpcHandler = exposeTinyRpc({
          adapter: httpServerAdapter({ endpoint: SERVER_RPC_PATH }),
          routes: {
            setupClient: (baseUrl) => {
              clientRpc = proxyTinyRpc({
                adapter: httpClientAdapter({ url: baseUrl + CLIENT_RPC_PATH }),
              });
            },
            transformIndexHtml: server.transformIndexHtml,
            ssrFetchModule: async (id, importer) => {
              return server.ssrFetchModule(id, importer);
            },
            send: (messages: string) => {
              connector.send(messages);
            },
            ...pluginOptions.customRpc,
          } satisfies ServerRpc,
        });
        const app = createApp();
        app.use(
          eventHandler((event) => {
            return serverRpcHandler({
              request: toWebRequest(event),
            });
          }),
          {
            match: (url) => url.includes(SERVER_RPC_PATH),
          }
        );
        app.use(
          eventHandler(async (event) => {
            const handler = await import("../client/client");

            return handler.default!.eventHandler(event, {
              __WORKER_ENTRY: pluginOptions.entry,
              __VITE_NODE_DEBUG: pluginOptions.debug ?? false,
              __VITE_RUNTIME_ROOT: server.config.root,
              __VITE_RUNTIME_HMR: pluginOptions.hmr ?? false,
            });
          }),
          {
            match: (url) => !url.includes(SERVER_RPC_PATH),
          }
        );
        return () => {
          app.use(
            eventHandler((event) => {
              console.log(event.path);
            })
          );
          server.middlewares.use(toNodeListener(app));
        };
      },
    },
  ];
}
