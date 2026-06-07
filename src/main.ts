/**
 * Static Site Generator CLI entry point — thin wrapper.
 *
 * Usage:
 *   bun run src/main.ts build --source <dir> --output <dir> [--layouts <dir>] [--public <dir>]
 *   bun run src/main.ts build --source <dir> --output <dir> [--layouts <dir>] [--public <dir>] --dev [--port <n>]
 *
 * All pipeline logic lives in syncs.  This file only parses CLI arguments,
 * registers syncs, and fires the build command.
 */
import { watch } from "node:fs";
import * as concepts from "@concepts";
import { Logging } from "@engine";
import syncs from "@syncs";
import { createDevSyncs } from "@syncs/dev.sync";
import { hashString, snapshotPath } from "@utils/snapshot";
import type { ID } from "@utils/types";

const { Commanding, Engine, Filing, Serving, Watching } = concepts;

Engine.logging = Logging.TRACE;
Engine.register(syncs);

// ── Parse CLI arguments ────────────────────────────────────────────────────

const args = Bun.argv.slice(2);
const command = args[0];

if (command !== "build") {
  console.error(
    "Usage: bun run src/main.ts build --source <dir> --output <dir> [--layouts <dir>] [--public <dir>] [--dev] [--port <n>]",
  );
  process.exit(1);
}

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

const source = getArg("--source");
const output = getArg("--output");
const layouts = getArg("--layouts") ?? "";
const publicDir = getArg("--public") ?? "";
const isDev = hasFlag("--dev");
const port = parseInt(getArg("--port") ?? "3000", 10);

if (!source || !output) {
  console.error(
    "Usage: bun run src/main.ts build --source <dir> --output <dir> [--layouts <dir>] [--public <dir>] [--dev] [--port <n>]",
  );
  process.exit(1);
}

const buildArgs = { source, output, layouts, public: publicDir };

// ── Dev mode ───────────────────────────────────────────────────────────────

if (isDev) {
  // Register dev syncs (write → reload)
  Engine.register(createDevSyncs({ Filing, Serving }));

  const srcDir = source;
  const outDir = output;

  // Start the dev server on the output directory
  const started = await Serving.start({ port, root: outDir });
  if ("error" in started) {
    console.error(`Failed to start dev server: ${started.error}`);
    process.exit(1);
  }
  console.log(`Dev server running at http://localhost:${port}`);

  // Create a watcher for the source directory
  const { watcher } = await Watching.create({ subject: srcDir as ID });

  // Helper: compute snapshot and poll
  async function checkAndRebuild() {
    const raw = await snapshotPath(srcDir);
    const snap = hashString(raw);
    const result = await Watching.poll({ watcher, currentSnapshot: snap });
    if ("change" in result) {
      console.log("Change detected, rebuilding...");
      await Commanding.issue({ name: "build", args: buildArgs });
    }
  }

  // Initial build
  console.log(`Building site from "${srcDir}" to "${outDir}"...`);
  await Commanding.issue({ name: "build", args: buildArgs });

  // Watch for file changes (debounced)
  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(srcDir, { recursive: true }, (_event, _filename) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(checkAndRebuild, 150);
  });

  console.log("Watching for changes...");

  // Keep the process alive
  await new Promise(() => {});
}

// ── One-shot build ─────────────────────────────────────────────────────────

console.log(`Building site from "${source}" to "${output}"...`);
const result = await Commanding.issue({ name: "build", args: buildArgs });

const [cmd] = await Commanding._get({ command: result.command });
if (!cmd || cmd.status === "FAILED") {
  console.error(`Build failed: ${cmd?.error ?? "unknown error"}`);
  process.exit(1);
}

console.log("Build complete.");
