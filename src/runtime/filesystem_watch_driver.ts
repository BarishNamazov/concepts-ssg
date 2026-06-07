/**
 * Bun filesystem watch driver — adapts fs.watch to the WatchDriver interface
 * used by the Watching concept.
 *
 * Keeps the Watching concept independent of runtime specifics. Tests can
 * substitute a fake driver for deterministic results.
 */

import { watch } from "node:fs";
import { hashString, snapshotPath } from "@utils/snapshot";
import type { WatchDriver } from "../concepts/Watching/WatchingConcept.ts";

export function createFilesystemWatchDriver(debounceMs = 150): WatchDriver {
  return {
    async snapshot(subject: string): Promise<string> {
      const raw = await snapshotPath(subject);
      return hashString(raw);
    },

    subscribe(subject: string, onSignal: () => void): () => void {
      let timer: ReturnType<typeof setTimeout> | undefined;

      const watcher = watch(subject, { recursive: true }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(onSignal, debounceMs);
      });

      return () => {
        if (timer) clearTimeout(timer);
        watcher.close();
      };
    },
  };
}
