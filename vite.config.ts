import { installGlobals } from "@remix-run/node";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { vitePlugin } from "@remix-run/dev";
import { vitePluginNitro } from "./plugin/server/plugin";

installGlobals();

export default defineConfig({
  server: {
    port: 3000,
  },
  ssr: {
    optimizeDeps: {
      include: [
        "react",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/server.browser",
        "@remix-run/server-runtime",
      ],
    },
  },
  plugins: [
    vitePluginNitro({
      entry: "./app/worker-entry.ts",
      debug: true,
      hmr: true,
      customRpc: {
        __remixGetCriticalCss: (...args: unknown[]) => {
          // @ts-expect-error this is defined
          return globalThis["__remix_devServerHooks"].getCriticalCss(...args);
        },
      },
    }),
    tsconfigPaths(),
    vitePlugin(),
  ],
});
