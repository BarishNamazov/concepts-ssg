/**
 * App factory — creates concepts, injects runtime drivers, registers all
 * syncs, and returns the instrumented concept instances ready for use by
 * the runtime boundary.
 *
 * This is the single point of assembly.  `src/main.ts` only calls this
 * factory and fires one root action.
 */

import { createConcepts } from "@concepts";
import { createSyncs } from "@syncs";
import WatchingConcept from "./concepts/Watching/WatchingConcept.ts";
import { createFilesystemWatchDriver } from "./runtime/filesystem_watch_driver.ts";

export function createApp() {
  const driver = createFilesystemWatchDriver(150);

  const rawWatching = new WatchingConcept(undefined, driver);

  const overrides = { Watching: rawWatching };

  const app = createConcepts({ overrides });

  // Wire the late-bound emitter so filesystem events go through the
  // instrumented `Watching.poll` action (entering the engine journal).
  rawWatching.pollEmitter = app.Watching.poll;

  const syncs = createSyncs(app);
  app.Engine.register(syncs);

  return app;
}
