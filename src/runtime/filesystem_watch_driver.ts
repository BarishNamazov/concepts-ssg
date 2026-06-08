/**
 * Filesystem watch driver — adapts `fs.watch` to structured runtime results.
 *
 * This module is runtime-only. It does not import concepts or the sync engine.
 */

import { watch } from "node:fs";
import { hashString, snapshotPath } from "@utils/snapshot";

export interface WatchSubscription {
  unsubscribe: () => void;
}

export interface WatchHandlers {
  signal: () => void;
  error: (error: string) => void;
}

export interface FilesystemWatchDriver {
  snapshot(subject: string): Promise<{ snapshot: string } | { error: string }>;
  subscribe(
    subject: string,
    handlers: WatchHandlers,
  ): { subscription: WatchSubscription } | { error: string };
}

export function createFilesystemWatchDriver(): FilesystemWatchDriver {
  return {
    async snapshot(
      subject: string,
    ): Promise<{ snapshot: string } | { error: string }> {
      try {
        const raw = await snapshotPath(subject);
        return { snapshot: hashString(raw) };
      } catch (error) {
        return { error: `Failed to snapshot ${subject}: ${String(error)}` };
      }
    },

    subscribe(
      subject: string,
      handlers: WatchHandlers,
    ): { subscription: WatchSubscription } | { error: string } {
      try {
        const watcher = watch(subject, { recursive: true }, () => {
          handlers.signal();
        });

        watcher.on("error", (error) => {
          handlers.error(
            `Filesystem watch failed for ${subject}: ${String(error)}`,
          );
        });

        return {
          subscription: {
            unsubscribe: () => {
              watcher.close();
            },
          },
        };
      } catch (error) {
        return { error: `Failed to watch ${subject}: ${String(error)}` };
      }
    },
  };
}
