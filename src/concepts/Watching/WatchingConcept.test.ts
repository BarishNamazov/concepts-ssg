import { beforeEach, describe, expect, test } from "bun:test";
import type { ID } from "@utils/types.ts";
import WatchingConcept from "./WatchingConcept.ts";

let Watching: WatchingConcept;

beforeEach(() => {
  Watching = new WatchingConcept();
});

const subject = "dir:/pages" as ID;

describe("Watching", () => {
  test("create returns a watcher id", async () => {
    const result = await Watching.create({ subject });
    expect(typeof result.watcher).toBe("string");
    expect(result.watcher.length).toBeGreaterThan(0);
  });

  test("create with initialSnapshot stores it", async () => {
    const { watcher } = await Watching.create({
      subject,
      initialSnapshot: "abc123",
    });
    const [doc] = await Watching._getWatcher({ watcher });
    expect(doc.lastSnapshot).toBe("abc123");
  });

  test("create defaults initialSnapshot to empty string", async () => {
    const { watcher } = await Watching.create({ subject });
    const [doc] = await Watching._getWatcher({ watcher });
    expect(doc.lastSnapshot).toBe("");
  });

  test("poll with different snapshot records a change", async () => {
    const { watcher } = await Watching.create({
      subject,
      initialSnapshot: "old",
    });

    const result = await Watching.poll({
      watcher,
      currentSnapshot: "new",
    });

    expect("change" in result).toBe(true);
    if ("change" in result) {
      expect(typeof result.change).toBe("string");
      expect(result.snapshot).toBe("new");
    }
  });

  test("poll with same snapshot returns unchanged", async () => {
    const { watcher } = await Watching.create({
      subject,
      initialSnapshot: "same",
    });

    const result = await Watching.poll({
      watcher,
      currentSnapshot: "same",
    });

    expect("unchanged" in result && result.unchanged === true).toBe(true);
  });

  test("poll updates stored snapshot after change", async () => {
    const { watcher } = await Watching.create({
      subject,
      initialSnapshot: "v1",
    });

    await Watching.poll({ watcher, currentSnapshot: "v2" });

    const [doc] = await Watching._getWatcher({ watcher });
    expect(doc.lastSnapshot).toBe("v2");
  });

  test("poll returns error for nonexistent watcher", async () => {
    const result = await Watching.poll({
      watcher: "nonexistent" as never,
      currentSnapshot: "x",
    });
    expect("error" in result).toBe(true);
  });

  test("_getChanges returns changes in reverse chronological order", async () => {
    const { watcher } = await Watching.create({
      subject,
      initialSnapshot: "s0",
    });

    // Record multiple changes
    await Watching.poll({ watcher, currentSnapshot: "s1" });
    await new Promise((r) => setTimeout(r, 5)); // ensure distinct timestamps
    await Watching.poll({ watcher, currentSnapshot: "s2" });

    const changes = await Watching._getChanges({ watcher });
    expect(changes.length).toBe(2);
    expect(changes[0].snapshot).toBe("s2");
    expect(changes[1].snapshot).toBe("s1");
  });

  test("_getChanges returns empty for watcher with no changes", async () => {
    const { watcher } = await Watching.create({ subject });
    const changes = await Watching._getChanges({ watcher });
    expect(changes).toHaveLength(0);
  });

  test("_getWatcher returns subject and lastSnapshot", async () => {
    const { watcher } = await Watching.create({
      subject,
      initialSnapshot: "init",
    });
    const [doc] = await Watching._getWatcher({ watcher });
    expect(doc.subject).toBe(subject);
    expect(doc.lastSnapshot).toBe("init");
  });

  test("_getWatcher returns empty for nonexistent watcher", async () => {
    const docs = await Watching._getWatcher({ watcher: "nope" as never });
    expect(docs).toHaveLength(0);
  });

  test("remove deletes watcher and its changes", async () => {
    const { watcher } = await Watching.create({ subject });
    await Watching.poll({ watcher, currentSnapshot: "changed" });

    const removed = await Watching.remove({ watcher });
    expect("error" in removed).toBe(false);

    const doc = await Watching._getWatcher({ watcher });
    expect(doc).toHaveLength(0);

    const changes = await Watching._getChanges({ watcher });
    expect(changes).toHaveLength(0);
  });

  test("remove returns error for nonexistent watcher", async () => {
    const result = await Watching.remove({ watcher: "nope" as never });
    expect("error" in result).toBe(true);
  });

  test("principle: create watcher, poll repeatedly, verify change log", async () => {
    const { watcher } = await Watching.create({
      subject: "app:source" as ID,
      initialSnapshot: "build-1",
    });

    // No change
    let result = await Watching.poll({
      watcher,
      currentSnapshot: "build-1",
    });
    expect("unchanged" in result).toBe(true);

    await new Promise((r) => setTimeout(r, 5));

    // First change
    result = await Watching.poll({
      watcher,
      currentSnapshot: "build-2",
    });
    expect("change" in result).toBe(true);

    await new Promise((r) => setTimeout(r, 5));

    // No change again
    result = await Watching.poll({
      watcher,
      currentSnapshot: "build-2",
    });
    expect("unchanged" in result).toBe(true);

    await new Promise((r) => setTimeout(r, 5));

    // Second change
    result = await Watching.poll({
      watcher,
      currentSnapshot: "build-3",
    });
    expect("change" in result).toBe(true);

    // Verify change log (most recent first)
    const changes = await Watching._getChanges({ watcher });
    expect(changes.length).toBe(2);
    expect(changes[0].snapshot).toBe("build-3");
    expect(changes[1].snapshot).toBe("build-2");

    // Each change has a unique id
    expect(changes[0].change).not.toBe(changes[1].change);
  });
});

describe("Watching active subscriptions", () => {
  test("start creates an ACTIVE watcher with subject and context", async () => {
    const result = await Watching.start({ subject, context: "dev-1" });
    if ("error" in result) throw new Error("unexpected error");
    expect(typeof result.watcher).toBe("string");
    expect(result.subject).toBe(subject);
    expect(result.context).toBe("dev-1");
  });

  test("start defaults context to null", async () => {
    const result = await Watching.start({ subject });
    if ("error" in result) throw new Error("unexpected error");
    expect(result.context).toBeNull();
  });

  test("stop transitions watcher to STOPPED", async () => {
    const result = await Watching.start({ subject });
    if ("error" in result) throw new Error("unexpected error");
    const { watcher } = result;

    const stopResult = await Watching.stop({ watcher });
    expect("error" in stopResult).toBe(false);

    const [doc] = await Watching._getWatcher({ watcher });
    expect(doc.status).toBe("STOPPED");
  });

  test("stop returns error for nonexistent watcher", async () => {
    const result = await Watching.stop({ watcher: "nope" as never });
    expect("error" in result).toBe(true);
  });

  test("_getByContext returns watchers with matching context", async () => {
    await Watching.start({ subject, context: "dev-42" });
    await Watching.start({ subject: "dir:/other" as ID, context: "dev-42" });
    await Watching.start({ subject: "dir:/third" as ID, context: "dev-other" });

    const rows = await Watching._getByContext({ context: "dev-42" });
    expect(rows).toHaveLength(2);
  });

  test("_getByContext returns empty for unknown context", async () => {
    const rows = await Watching._getByContext({ context: "unknown" });
    expect(rows).toHaveLength(0);
  });

  test("_getWatcher returns context and status for started watcher", async () => {
    const result = await Watching.start({ subject, context: "ctx" });
    if ("error" in result) throw new Error("unexpected error");
    const { watcher } = result;

    const [doc] = await Watching._getWatcher({ watcher });
    expect(doc.context).toBe("ctx");
    expect(doc.status).toBe("ACTIVE");
  });

  test("_getWatcher returns context and status for created watcher", async () => {
    const { watcher } = await Watching.create({ subject });

    const [doc] = await Watching._getWatcher({ watcher });
    expect(doc.context).toBeNull();
    expect(doc.status).toBe("STOPPED");
  });

  test("remove also unsubscribes active watcher", async () => {
    const result = await Watching.start({ subject });
    if ("error" in result) throw new Error("unexpected error");
    const { watcher } = result;
    await Watching.remove({ watcher });

    const rows = await Watching._getWatcher({ watcher });
    expect(rows).toHaveLength(0);
  });

  test("poll on change returns subject and context", async () => {
    const result = await Watching.start({
      subject,
      context: "my-ctx",
    });
    if ("error" in result) throw new Error("unexpected error");
    const { watcher } = result;

    await Watching.poll({ watcher, currentSnapshot: "s1" });

    const pollResult = await Watching.poll({ watcher, currentSnapshot: "s2" });
    if ("change" in pollResult) {
      expect(pollResult.subject).toBe(subject);
      expect(pollResult.context).toBe("my-ctx");
    }
  });

  test("driver integration: start takes snapshot and emits poll on subscribe signal", async () => {
    let subscribedPath = "";
    let signalCallback: (() => void) | undefined;

    const fakeDriver = {
      snapshot: async (p: string) => `snap-${p}-1`,
      subscribe: (p: string, onSignal: () => void) => {
        subscribedPath = p;
        signalCallback = onSignal;
        return () => {};
      },
    };

    const pollCalls: { watcher: string; currentSnapshot: string }[] = [];
    const emitter = async (input: {
      watcher: string;
      currentSnapshot: string;
    }) => {
      pollCalls.push(input);
      return {};
    };

    const w = new WatchingConcept(
      undefined,
      fakeDriver as never,
      emitter as never,
    );

    const startResult = await w.start({
      subject: "dir:/src" as ID,
      context: "dev-1",
    });
    if ("error" in startResult) throw new Error("unexpected error");
    const { watcher } = startResult;

    expect(subscribedPath).toBe("dir:/src");

    // Verify snapshot was taken
    const [doc] = await w._getWatcher({ watcher });
    expect(doc.lastSnapshot).toBe("snap-dir:/src-1");

    // Signal a change — should be debounced
    signalCallback?.();

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 200));

    expect(pollCalls.length).toBe(1);
    expect(pollCalls[0].watcher).toBe(watcher);
    expect(pollCalls[0].currentSnapshot).toBe("snap-dir:/src-1");
  });
});
