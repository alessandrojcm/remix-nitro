# Remix + Nitro

This is an example of using Remix (with the Vite Plugin) + Remix using Vite's [experimental](https://vitejs.dev/guide/api-vite-runtime.html#vite-runtime-api)
runtime API. It is based on the [Vite Miniflare](https://github.com/hi-ogawa/vite-plugins/blob/main/packages/vite-node-miniflare), modified,
so it runs in node instead of Miniflare and wiring it up with Nitro. To execute, run `node ./dev.js`.

Caveats: since the worker (which is run by Vite) and Nitro run independently to one another, the Nitro's runtime
config is not available within the Remix handler. We work around this in dev by exposing a GET endpoint as a `devHandler`
and calling said endpoint in the Remix worker entry. This is obviously not safe because the Nitro runtime could contain
sensitive information, but it is only for dev, so it is probably ok.