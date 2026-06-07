/**
 * Pure CLI argument parser for the static site generator.
 *
 * Interprets argv strings (the tokens after the program name and command)
 * into a discriminated result.  Designed to be used from sync `where` clauses
 * so it must remain a pure function — no process.exit, no logging, no side
 * effects.
 *
 * Preserves existing CLI compatibility:
 *   build --source <dir> --output <dir> [--layouts <dir>] [--public <dir>]
 *   build --source <dir> --output <dir> [--layouts <dir>] [--public <dir>] --dev [--port <n>]
 */

const USAGE =
  "bun run src/main.ts build --source <dir> --output <dir> [--layouts <dir>] [--public <dir>] [--dev] [--port <n>]";

export type ParsedCli =
  | { kind: "build"; args: Record<string, string> }
  | { kind: "dev"; args: Record<string, string> }
  | { kind: "invalid"; error: string; usage: string };

export function parseCli(argv: string[]): ParsedCli {
  const command = argv[0];

  if (command !== "build") {
    return {
      kind: "invalid",
      error: `Unknown command: ${command}`,
      usage: USAGE,
    };
  }

  function getArg(flag: string): string | undefined {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  }

  function hasFlag(flag: string): boolean {
    return argv.includes(flag);
  }

  const source = getArg("--source");
  const output = getArg("--output");

  if (!source || !output) {
    return {
      kind: "invalid",
      error: "Missing required --source or --output",
      usage: USAGE,
    };
  }

  const layouts = getArg("--layouts") ?? "";
  const publicDir = getArg("--public") ?? "";
  const isDev = hasFlag("--dev");
  const port = getArg("--port") ?? "3000";

  const args = { source, output, layouts, public: publicDir, port };

  return isDev ? { kind: "dev", args } : { kind: "build", args };
}
