import type { AppConcepts } from "@concepts";
import { actions, type Sync } from "@engine";
import type { FilesystemWatchAdapter } from "../runtime/filesystem_watch_adapter.ts";

export function createRuntimeWatchSyncs({
  Watching,
  WatchRuntime,
}: {
  Watching: AppConcepts["Watching"];
  WatchRuntime: FilesystemWatchAdapter;
}) {
  const RuntimeWatchStart: Sync = ({ watcher, subject, context }) => ({
    when: actions([Watching.start, {}, { watcher, subject, context }]),
    then: actions([WatchRuntime.subscribe, { watcher, subject, context }]),
  });

  const RuntimeWatchObserve: Sync = ({ watcher, snapshot }) => ({
    when: actions([WatchRuntime.subscribe, {}, { watcher, snapshot }]),
    then: actions([Watching.observe, { watcher, snapshot }]),
  });

  const RuntimeWatchSubscribeFail: Sync = ({ watcher, error }) => ({
    when: actions([WatchRuntime.subscribe, {}, { watcher, error }]),
    then: actions([Watching.fail, { watcher, error }]),
  });

  const RuntimeWatchStop: Sync = ({ watcher }) => ({
    when: actions([Watching.stop, {}, { watcher }]),
    then: actions([WatchRuntime.unsubscribe, { watcher }]),
  });

  const RuntimeWatchRemove: Sync = ({ watcher }) => ({
    when: actions([Watching.remove, {}, { watcher }]),
    then: actions([WatchRuntime.unsubscribe, { watcher }]),
  });

  return {
    RuntimeWatchStart,
    RuntimeWatchObserve,
    RuntimeWatchSubscribeFail,
    RuntimeWatchStop,
    RuntimeWatchRemove,
  };
}
