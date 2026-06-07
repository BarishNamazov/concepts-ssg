/**
 * Static Site Generator CLI entry point — thin wrapper.
 *
 * Usage:
 *   bun run src/main.ts build --source <dir> --output <dir> [--layouts <dir>] [--public <dir>]
 *
 * All pipeline logic lives in syncs.  This file only parses CLI arguments,
 * registers syncs, and fires the build command.
 */
import * as concepts from "@concepts";
import { Logging } from "@engine";
import syncs from "@syncs";

const { Commanding, Engine } = concepts;

Engine.logging = Logging.TRACE;
Engine.register(syncs);

// ── Parse CLI arguments ────────────────────────────────────────────────────

const args = Bun.argv.slice(2);
const command = args[0];

if (command !== "build") {
  console.error(
    "Usage: bun run src/main.ts build --source <dir> --output <dir> [--layouts <dir>] [--public <dir>]",
  );
  process.exit(1);
}

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const source = getArg("--source");
const output = getArg("--output");
const layouts = getArg("--layouts") ?? "";
const publicDir = getArg("--public") ?? "";

if (!source || !output) {
  console.error(
    "Usage: bun run src/main.ts build --source <dir> --output <dir> [--layouts <dir>] [--public <dir>]",
  );
  process.exit(1);
}

// ── Run the build ──────────────────────────────────────────────────────────

console.log(`Building site from "${source}" to "${output}"...`);
const result = await Commanding.issue({
  name: "build",
  args: { source, output, layouts, public: publicDir },
});

const [cmd] = await Commanding._get({ command: result.command });
if (!cmd || cmd.status === "FAILED") {
  console.error(`Build failed: ${cmd?.error ?? "unknown error"}`);
  process.exit(1);
}

console.log("Build complete.");
