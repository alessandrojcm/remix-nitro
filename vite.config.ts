import { installGlobals } from "@remix-run/node";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { vitePluginNitro } from "./plugin/server/plugin";
import { vitePlugin } from "@remix-run/dev";

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
    }),
    tsconfigPaths(),
    vitePlugin(),
  ],
});
