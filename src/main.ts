/**
 * Static Site Generator CLI entry point — thin runtime adapter.
 *
 * All application behaviour (build pipeline, dev server, file watching,
 * live reload, error reporting) is expressed as concept actions composed
 * by declarative synchronizations.
 */
import { createApp } from "./app";

const app = createApp();
await app.CommandLine.invoke({ argv: Bun.argv.slice(2) });
