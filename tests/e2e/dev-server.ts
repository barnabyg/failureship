import path from "node:path";
import { test } from "@playwright/test";
import { createServer, type Plugin } from "vite";

/**
 * The dev server `npm run play` uses, on a port the system chooses. Each server
 * has a Vite cache of its own, named for its caller and the worker, since tests
 * run fully in parallel and two servers sharing a cache race to write it.
 */
export async function startDevServer(
  cache: string,
  options: { plugins?: Plugin[] } = {},
) {
  const { workerIndex } = test.info();
  const server = await createServer({
    root: path.join(import.meta.dirname, "../.."),
    logLevel: "silent",
    cacheDir: `node_modules/.vite-${cache}-${String(workerIndex)}`,
    server: { port: 0, watch: null },
    ...options,
  });
  await server.listen();
  const origin = server.resolvedUrls?.local[0];
  if (!origin) throw new Error("The dev server has no local address.");
  return { server, origin };
}
