import { defineNitroConfig } from "nitropack/config";

export default defineNitroConfig({
  debug: true,
  logLevel: 5,
  srcDir: "server",
  experimental: {
    asyncContext: true,
  },
  publicAssets: [
    {
      // base dir is server so we need to get one directory up
      dir: "../public",
    },
  ],
  runtimeConfig: {
    context: "context",
  },
});
