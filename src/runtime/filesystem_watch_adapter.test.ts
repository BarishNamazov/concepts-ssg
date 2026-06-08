import { describe, expect, test } from "bun:test";
import { createConcepts } from "@concepts";
import type { ID } from "@utils/types.ts";
import { createRuntimeWatchSyncs } from "../syncs/runtime-watch.sync.ts";
import {
  FilesystemWatchAdapter,
  type WatchingRuntimeActions,
} from "./filesystem_watch_adapter.ts";
import type {
  FilesystemWatchDriver,
  WatchHandlers,
} from "./filesystem_watch_driver.ts";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createFakeDriver(options: { subscribeError?: string } = {}) {
  let handlers: WatchHandlers | undefined;
  let snapshot = "initial";
  let subscribedSubject = "";
  let unsubscribeCalls = 0;

  const driver: FilesystemWatchDriver = {
    async snapshot() {
      return { snapshot };
    },
    subscribe(subject, nextHandlers) {
      if (options.subscribeError) return { error: options.subscribeError };
      subscribedSubject = subject;
      handlers = nextHandlers;
      return {
        subscription: {
          unsubscribe: () => {
            unsubscribeCalls += 1;
          },
        },
      };
    },
  };

  return {
    driver,
    get handlers() {
      return handlers;
    },
    get subscribedSubject() {
      return subscribedSubject;
    },
    get unsubscribeCalls() {
      return unsubscribeCalls;
    },
    setSnapshot(next: string) {
      snapshot = next;
    },
  };
}

function setupRuntimeWatch(driver: FilesystemWatchDriver, debounceMs = 5) {
  const app = createConcepts();
  const Watching = {
    poll: app.Watching.poll,
    fail: app.Watching.fail,
    _getWatcher: app.Watching._getWatcher,
  } as unknown as WatchingRuntimeActions;
  const WatchRuntime = app.Engine.instrumentConcept(
    new FilesystemWatchAdapter(driver, Watching, debounceMs),
  );

  app.Engine.register(
    createRuntimeWatchSyncs({ Watching: app.Watching, WatchRuntime }),
  );

  return app;
}

describe("FilesystemWatchAdapter", () => {
  test("runtime sync subscribes and observes the initial snapshot", async () => {
    const fake = createFakeDriver();
    const app = setupRuntimeWatch(fake.driver);

    const { watcher } = await app.Watching.start({
      subject: "/tmp/pages" as ID,
      context: "dev-1",
    });

    expect(fake.subscribedSubject).toBe("/tmp/pages");

    const [doc] = await app.Watching._getWatcher({ watcher });
    expect(doc.status).toBe("ACTIVE");
    expect(doc.lastSnapshot).toBe("initial");
  });

  test("debounces filesystem signals into one Watching.poll", async () => {
    const fake = createFakeDriver();
    const app = setupRuntimeWatch(fake.driver);

    const { watcher } = await app.Watching.start({
      subject: "/tmp/pages" as ID,
      context: "dev-1",
    });

    fake.setSnapshot("changed");
    fake.handlers?.signal();
    fake.handlers?.signal();

    await delay(25);

    const changes = await app.Watching._getChanges({ watcher });
    expect(changes).toHaveLength(1);
    expect(changes[0].snapshot).toBe("changed");
  });

  test("timer callback does not poll after watcher stops", async () => {
    const fake = createFakeDriver();
    let status = "ACTIVE";
    const pollCalls: { watcher: string; currentSnapshot: string }[] = [];
    const failCalls: { watcher: string; error: string }[] = [];
    const adapter = new FilesystemWatchAdapter(
      fake.driver,
      {
        poll: async (input) => {
          pollCalls.push(input);
          return {};
        },
        fail: async (input) => {
          failCalls.push(input);
          return {};
        },
        _getWatcher: async () => [{ status }],
      },
      5,
    );

    await adapter.subscribe({
      watcher: "watcher-1",
      subject: "/tmp/pages",
      context: "dev-1",
    });

    fake.setSnapshot("changed");
    fake.handlers?.signal();
    status = "STOPPED";

    await delay(25);

    expect(pollCalls).toHaveLength(0);
    expect(failCalls).toHaveLength(0);
  });

  test("subscribe failure becomes a structured Watching failure", async () => {
    const fake = createFakeDriver({
      subscribeError: "recursive watch unsupported",
    });
    const app = setupRuntimeWatch(fake.driver);

    const { watcher } = await app.Watching.start({
      subject: "/tmp/pages" as ID,
      context: "dev-1",
    });

    const [doc] = await app.Watching._getWatcher({ watcher });
    expect(doc.status).toBe("FAILED");
    expect(doc.error).toBe("recursive watch unsupported");
  });

  test("driver runtime errors become structured Watching failures", async () => {
    const fake = createFakeDriver();
    const app = setupRuntimeWatch(fake.driver);

    const { watcher } = await app.Watching.start({
      subject: "/tmp/pages" as ID,
      context: "dev-1",
    });

    fake.handlers?.error("watch event failed");
    await delay(5);

    const [doc] = await app.Watching._getWatcher({ watcher });
    expect(doc.status).toBe("FAILED");
    expect(doc.error).toBe("watch event failed");
    expect(fake.unsubscribeCalls).toBe(1);
  });
});
