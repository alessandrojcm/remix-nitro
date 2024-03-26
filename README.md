# Remix + Nitro

This is an example of using Remix (with the Vite Plugin) + Remix using Vite's [experimental](https://vitejs.dev/guide/api-vite-runtime.html#vite-runtime-api)
runtime API. It is based on the [Vite Miniflare](https://github.com/hi-ogawa/vite-plugins/blob/main/packages/vite-node-miniflare), modified,
so it runs in node instead of Miniflare and wiring it up with Nitro. To execute, run `node ./dev.js`.

Caveats: since the worker (which is run by Vite) and Nitro run independently to one another, the Nitro's runtime
config is not available within the Remix handler. We work around this in dev by exposing a GET endpoint as a `devHandler`
and calling said endpoint in the Remix worker entry. This is obviously not safe because the Nitro runtime could contain
sensitive information, but it is only for dev, so it is probably ok.

# Caveats
## Context sharing
This example uses `unctx` to share the event context and the Nitro runtime configuration, so it is available in the 
Vite worker entry. This is a bit experimental, but it works, and it is only for the development server.

## Nitro middleware do not work in dev mode
In order to enable hot reload for the dev server, Nitro internally creates an H3 app for the dev server and then creates
a separate worker to run the Rollup watcher, it does this to be able to re-build the source code as needed without having to re-start
the dev server and to handle the worker's exceptions gracefully, to server the request from the `routes`, `api`, `middleware`, etc
Nitro proxies requests from the dev server to the worker. `devHandlers`, on the other hand, are added programmatically and
are not part of the build process, so Nitro adds them internally to the dev server app and **not** to the worker, so if
the `devHandler` returns a response (which is the case for our Vite middleware) then the request does not hit the proxy
and middleware do not run. This would not happen in production but if you are relying on middleware to modify your
event context to pass it to Remix, then you would need to find a workaround for the dev server.