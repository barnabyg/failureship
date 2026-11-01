import path from "node:path";
import { createServer, type Plugin } from "vite";

/** The dev server `npm run play` uses, on a port the system chooses. */
export async function startDevServer(
  options: { cacheDir?: string; plugins?: Plugin[] } = {},
) {
  const server = await createServer({
    root: path.join(import.meta.dirname, "../.."),
    logLevel: "silent",
    server: { port: 0, watch: null },
    ...options,
  });
  await server.listen();
  const origin = server.resolvedUrls?.local[0];
  if (!origin) throw new Error("The dev server has no local address.");
  return { server, origin };
}
