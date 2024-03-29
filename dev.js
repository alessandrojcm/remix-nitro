import { build, createDevServer, createNitro, prepare } from "nitropack";
import { createServer } from "vite";
import { eventHandler, fromNodeMiddleware } from "h3";
import { consola } from "consola";
import { runtimeContext } from "./plugin/shared.js";

const hmrKeyRe = /^runtimeConfig\.|routeRules\./;

function getViteServer() {
  return createServer({
    server: {
      middlewareMode: true,
    },
    appType: "custom",
    // consola does not map 1:1 to logger, but it works
    customLogger: consola.withTag("vite"),
  });
}
// Basically just copy-pasting Nitro's dev command, but
// injecting vite in the process. We do this here
// as opposed of doing it in the nitro.config.ts file
// because nitro uses jiti internally to load the config file and it does so
// using CJS instead of ESM thus firing Vite's CJS mode (which is deprecated).
// Doing it inside a route handler does not allow us to listen for
// server reloads either so we cannot close and recreate Vite
// https://github.com/unjs/nitro/blob/main/src/cli/commands/dev.ts
async function startDevServer() {
  let viteDevServer = await getViteServer();
  /**
   * @type {import('nitropack').Nitro} Nitro
   */
  let nitro;
  const reload = async () => {
    if (nitro) {
      consola.withTag("nitro").info("Restarting dev server...");
      if ("unwatch" in nitro.options._c12) {
        await nitro.options._c12.unwatch();
      }
      // we need to restart vite or else we will get hydration mismatches
      await viteDevServer.close();
      await nitro.close();
      viteDevServer = await getViteServer();
    }
    /**
     * @type {import('nitropack').Nitro} Nitro
     */
    nitro = await createNitro(
      {
        experimental: {
          asyncContext: true,
          openAPI: true,
        },
        rootDir: ".",
        dev: true,
        preset: "nitro-dev",
        devHandlers: [
          {
            route: "/",
            handler: eventHandler(() => {
              const event = runtimeContext.use().event;
              if (!event.path.includes("api")) {
                event.context = {
                  message: "from dev.js",
                };
                return fromNodeMiddleware(viteDevServer.middlewares)(event);
              }
            }),
          },
        ],
      },
      {
        watch: true,
        c12: {
          onWatch: (event) => {
            console.log(event);
          },
          async onUpdate({ getDiff, newConfig }) {
            const diff = getDiff();

            if (diff.length === 0) {
              return; // No changes
            }

            console.info(
              "Nitro config updated:\n" +
                diff.map((entry) => `  ${entry.toString()}`).join("\n")
            );

            await (diff.every((e) => hmrKeyRe.test(e.key))
              ? nitro.updateConfig(newConfig.config) // Hot reload
              : reload()); // Full reload
          },
        },
      }
    );
    nitro.logger = consola.withTag("nitro");
    const server = createDevServer(nitro);
    const _handler = server.app.handler;
    server.app.handler = (event) => {
      return runtimeContext.callAsync(
        {
          event,
          runtime: nitro.options.runtimeConfig,
        },
        () => _handler(event)
      );
    };
    nitro.hooks.hookOnce("restart", reload);
    await server.listen(3000).then(() => {
      consola.withTag("nitro").info("listening on port 3000");
    });
    await prepare(nitro);
    await build(nitro);
  };
  await reload();
}
startDevServer();
