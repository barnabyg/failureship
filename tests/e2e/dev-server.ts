import path from "node:path";
import { createServer } from "vite";

/** The dev server `npm run play` uses, on a port the system chooses. */
export async function startDevServer(cacheDir?: string) {
  const server = await createServer({
    root: path.join(import.meta.dirname, "../.."),
    logLevel: "silent",
    server: { port: 0, watch: null },
    ...(cacheDir === undefined ? {} : { cacheDir }),
  });
  await server.listen();
  const origin = server.resolvedUrls?.local[0];
  if (!origin) throw new Error("The dev server has no local address.");
  return { server, origin };
}
