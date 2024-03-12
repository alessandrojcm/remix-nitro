// from https://github.com/nksaraf/vinxi/blob/main/packages/vinxi/lib/nitro-dev.js
import { listen, Listener, ListenOptions } from "listhen";
import wsAdapter from "crossws/adapters/node";
import {
  createApp,
  eventHandler,
  fromNodeMiddleware,
  H3Event,
  promisifyNodeListener,
  toNodeListener,
} from "h3";
import httpProxy from "http-proxy";
import { servePlaceholder } from "serve-placeholder";
import { joinURL } from "ufo";
import {
  createCall,
  createFetch as createLocalFetch,
} from "unenv/runtime/fetch/index";
import { type Nitro } from "nitropack";
import { createRouteRulesHandler } from "nitropack/runtime/route-rules";
import sirv from "sirv";

/**
 *
 * @param {import("nitropack").Nitro} nitro
 * @returns
 */
export async function createDevServer(nitro: Nitro) {
  // App
  const app = createApp();

  // Create local fetch callers
  const localCall = createCall(promisifyNodeListener(toNodeListener(app)));
  const localFetch = createLocalFetch(localCall, globalThis.fetch);

  // Debugging endpoint to view vfs
  // app.use("/_vfs", createVFSHandler(nitro));
  //
  app.use(
    createRouteRulesHandler({
      localFetch,
      routeRules: nitro.options.routeRules,
    })
  );

  // Serve asset dirs
  for (const asset of nitro.options.publicAssets) {
    const url = joinURL(
      nitro.options.runtimeConfig.app.baseURL,
      asset.baseURL ?? "/"
    );
    app.use(url, fromNodeMiddleware(sirv(asset.dir)));
    if (!asset.fallthrough) {
      app.use(url, fromNodeMiddleware(servePlaceholder()));
    }
  }

  // User defined dev proxy
  for (const route of Object.keys(nitro.options.devProxy).sort().reverse()) {
    let opts = nitro.options.devProxy[route];
    if (typeof opts === "string") {
      opts = { target: opts };
    }
    const proxy = createProxy(opts);
    app.use(
      route,
      eventHandler(async (event) => {
        await proxy.handle(event);
      })
    );
  }

  const wsApp = createApp();

  // Dev-only handlers
  for (const handler of nitro.options.devHandlers) {
    app.use(
      joinURL(nitro.options.runtimeConfig.app.baseURL, handler.route ?? "/"),
      handler.handler
    );
    wsApp.use(
      joinURL(nitro.options.runtimeConfig.app.baseURL, handler.route ?? "/"),
      handler.handler
    );
  }

  import.meta._asyncContext = nitro.options.experimental?.asyncContext;

  if (import.meta._asyncContext) {
    const { getContext } = await import("unctx");
    const { AsyncLocalStorage } = await import("node:async_hooks");
    const nitroAsyncContext = getContext("nitro-app", {
      asyncContext: true,
      AsyncLocalStorage,
    });
    const _handler = app.handler;
    app.handler = (event) => {
      const ctx = { event };
      return nitroAsyncContext.callAsync(ctx, () => _handler(event));
    };
  }

  const adapter = wsAdapter({
    ...wsApp.websocket,
    hooks: {
      open: (event) => {
        event.ctx.node.req.url = event.ctx.node.req.originalUrl;
      },
      message: (event) => {
        event.ctx.node.req.url = event.ctx.node.req.originalUrl;
      },
      close: (event) => {
        event.ctx.node.req.url = event.ctx.node.req.originalUrl;
      },
      error: (event) => {
        event.ctx.node.req.url = event.ctx.node.req.originalUrl;
      },
      upgrade: (event) => {
        // event.ctx.node.req.url = event.ctx.node.req.originalUrl;
      },
    },
  });
  let listeners: Listener[] = [];
  const _listen = async (port: number, opts: ListenOptions) => {
    const listener = await listen(toNodeListener(app), {
      port,
      ws: true,
      ...opts,
    });
    listeners.push(listener);
    import.meta._websocket = nitro.options.experimental?.websocket;
    if (import.meta._websocket) {
      console.log("enabling websockets");
      listener.server.on("upgrade", (req, sock, head) => {
        req.url = req.originalUrl;
        adapter.handleUpgrade(req, sock, head);
      });
    }
    return listener;
  };
  // Close handler
  async function close() {
    await Promise.all(listeners.map((l) => l.close()));
    listeners = [];
  }
  nitro.hooks.hook("close", close);

  return {
    listen: _listen,
    h3App: app,
    localCall,
    localFetch,
    close,
  };
}

function createProxy(defaults = {}) {
  const proxy = httpProxy.createProxy();
  const handle = (event: H3Event, opts = {}) => {
    return new Promise((resolve, reject) => {
      proxy.web(
        event.node.req,
        event.node.res,
        { ...defaults, ...opts },
        (error) => {
          if (error.code !== "ECONNRESET") {
            reject(error);
          }
          resolve();
        }
      );
    });
  };
  return {
    proxy,
    handle,
  };
}
