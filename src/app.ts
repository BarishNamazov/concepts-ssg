/**
 * App factory — creates concepts, registers all syncs, and assembles runtime
 * adapters at the boundary.
 *
 * This is the single point of assembly. `src/main.ts` only calls this factory
 * and fires one root action.
 */

import { createConcepts } from "@concepts";
import { createSyncs } from "@syncs";
import { CommandLineRuntimeAdapter } from "./runtime/command_line_runtime_adapter.ts";
import {
  FilesystemWatchAdapter,
  type WatchingRuntimeActions,
} from "./runtime/filesystem_watch_adapter.ts";
import { createFilesystemWatchDriver } from "./runtime/filesystem_watch_driver.ts";
import { createRuntimeCliSyncs } from "./syncs/runtime-cli.sync.ts";
import { createRuntimeWatchSyncs } from "./syncs/runtime-watch.sync.ts";

export function createApp() {
  const app = createConcepts();
  const driver = createFilesystemWatchDriver();
  const Watching = {
    poll: app.Watching.poll,
    fail: app.Watching.fail,
    _getWatcher: app.Watching._getWatcher,
  } as unknown as WatchingRuntimeActions;

  const WatchRuntime = app.Engine.instrumentConcept(
    new FilesystemWatchAdapter(driver, Watching, 150),
  );
  const CommandLineRuntime = app.Engine.instrumentConcept(
    new CommandLineRuntimeAdapter(),
  );

  app.Engine.register(
    createRuntimeCliSyncs({
      CommandLine: app.CommandLine,
      CommandLineRuntime,
    }),
  );

  app.Engine.register(
    createRuntimeWatchSyncs({ Watching: app.Watching, WatchRuntime }),
  );

  const syncs = createSyncs(app);
  app.Engine.register(syncs);

  return { ...app, WatchRuntime, CommandLineRuntime };
}
