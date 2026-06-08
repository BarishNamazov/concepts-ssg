import { beforeEach, describe, expect, test } from "bun:test";
import type { ID } from "@utils/types.ts";
import WatchingConcept from "./WatchingConcept.ts";

let Watching: WatchingConcept;

beforeEach(() => {
  Watching = new WatchingConcept();
});

const subject = "dir:/pages" as ID;

describe("Watching", () => {
  test("create returns a stopped watcher id", async () => {
    const result = await Watching.create({ subject });
    expect(typeof result.watcher).toBe("string");
    expect(result.watcher.length).toBeGreaterThan(0);

    const [doc] = await Watching._getWatcher({ watcher: result.watcher });
    expect(doc.status).toBe("STOPPED");
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

  test("start creates an active watcher with subject and context", async () => {
    const result = await Watching.start({ subject, context: "dev-1" });
    expect(typeof result.watcher).toBe("string");
    expect(result.subject).toBe(subject);
    expect(result.context).toBe("dev-1");

    const [doc] = await Watching._getWatcher({ watcher: result.watcher });
    expect(doc.status).toBe("ACTIVE");
  });

  test("start stores initialSnapshot and defaults context to null", async () => {
    const result = await Watching.start({ subject, initialSnapshot: "init" });

    expect(result.context).toBeNull();

    const [doc] = await Watching._getWatcher({ watcher: result.watcher });
    expect(doc.lastSnapshot).toBe("init");
  });

  test("observe updates stored snapshot without recording a change", async () => {
    const { watcher } = await Watching.start({ subject });

    const result = await Watching.observe({ watcher, snapshot: "baseline" });
    expect("error" in result).toBe(false);

    const [doc] = await Watching._getWatcher({ watcher });
    expect(doc.lastSnapshot).toBe("baseline");

    const changes = await Watching._getChanges({ watcher });
    expect(changes).toHaveLength(0);
  });

  test("observe rejects stopped watchers", async () => {
    const { watcher } = await Watching.create({ subject });

    const result = await Watching.observe({ watcher, snapshot: "baseline" });
    expect("error" in result).toBe(true);
  });

  test("poll with different snapshot records a change", async () => {
    const { watcher } = await Watching.start({
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
    const { watcher } = await Watching.start({
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
    const { watcher } = await Watching.start({
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

  test("poll returns error for stopped watcher", async () => {
    const { watcher } = await Watching.start({
      subject,
      initialSnapshot: "s1",
    });
    await Watching.stop({ watcher });

    const result = await Watching.poll({ watcher, currentSnapshot: "s2" });
    expect("error" in result).toBe(true);

    const changes = await Watching._getChanges({ watcher });
    expect(changes).toHaveLength(0);
  });

  test("_getChanges returns changes in reverse chronological order", async () => {
    const { watcher } = await Watching.start({
      subject,
      initialSnapshot: "s0",
    });

    await Watching.poll({ watcher, currentSnapshot: "s1" });
    await new Promise((r) => setTimeout(r, 5));
    await Watching.poll({ watcher, currentSnapshot: "s2" });

    const changes = await Watching._getChanges({ watcher });
    expect(changes.length).toBe(2);
    expect(changes[0].snapshot).toBe("s2");
    expect(changes[1].snapshot).toBe("s1");
  });

  test("_getChanges returns empty for watcher with no changes", async () => {
    const { watcher } = await Watching.start({ subject });
    const changes = await Watching._getChanges({ watcher });
    expect(changes).toHaveLength(0);
  });

  test("_getWatcher returns subject and lastSnapshot", async () => {
    const { watcher } = await Watching.start({
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

  test("stop transitions watcher to STOPPED", async () => {
    const { watcher } = await Watching.start({ subject });

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

  test("fail marks watcher as failed with structured context", async () => {
    const { watcher } = await Watching.start({ subject, context: "dev-1" });

    const result = await Watching.fail({ watcher, error: "watch failed" });
    expect("watcher" in result).toBe(true);
    if ("watcher" in result) {
      expect(result.subject).toBe(subject);
      expect(result.context).toBe("dev-1");
      expect(result.error).toBe("watch failed");
    }

    const [doc] = await Watching._getWatcher({ watcher });
    expect(doc.status).toBe("FAILED");
    expect(doc.error).toBe("watch failed");
  });

  test("fail returns error for nonexistent watcher", async () => {
    const result = await Watching.fail({
      watcher: "nope" as never,
      error: "watch failed",
    });
    expect("watcher" in result).toBe(false);
  });

  test("remove deletes watcher and its changes", async () => {
    const { watcher } = await Watching.start({ subject });
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

  test("principle: start watcher, poll repeatedly, verify change log", async () => {
    const { watcher } = await Watching.start({
      subject: "app:source" as ID,
      initialSnapshot: "build-1",
    });

    let result = await Watching.poll({
      watcher,
      currentSnapshot: "build-1",
    });
    expect("unchanged" in result).toBe(true);

    await new Promise((r) => setTimeout(r, 5));

    result = await Watching.poll({
      watcher,
      currentSnapshot: "build-2",
    });
    expect("change" in result).toBe(true);

    await new Promise((r) => setTimeout(r, 5));

    result = await Watching.poll({
      watcher,
      currentSnapshot: "build-2",
    });
    expect("unchanged" in result).toBe(true);

    await new Promise((r) => setTimeout(r, 5));

    result = await Watching.poll({
      watcher,
      currentSnapshot: "build-3",
    });
    expect("change" in result).toBe(true);

    const changes = await Watching._getChanges({ watcher });
    expect(changes.length).toBe(2);
    expect(changes[0].snapshot).toBe("build-3");
    expect(changes[1].snapshot).toBe("build-2");
    expect(changes[0].change).not.toBe(changes[1].change);
  });
});
