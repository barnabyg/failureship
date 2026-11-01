// Prepares and launches the game: installs dependencies when they are missing
// or out of date, then starts the dev server and opens the browser.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lockfile = path.join(root, "package-lock.json");
const installed = path.join(root, "node_modules", ".package-lock.json");

const upToDate =
  existsSync(installed) &&
  statSync(installed).mtimeMs >= statSync(lockfile).mtimeMs;

if (!upToDate) {
  console.log("Installing dependencies. This happens once.");
  const install = spawnSync("npm ci --no-audit --no-fund", {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  if (install.status !== 0) process.exit(install.status ?? 1);
}

const args = [path.join(root, "node_modules", "vite", "bin", "vite.js")];
if (!process.argv.includes("--no-open")) args.push("--open");
const server = spawn(process.execPath, args, { cwd: root, stdio: "inherit" });
server.on("exit", (code) => process.exit(code ?? 0));
