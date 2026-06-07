import { freshID } from "@utils/database.ts";
import type { ID } from "@utils/types.ts";

type Subject = ID;
type Watcher = ID;
type Change = ID;

interface WatcherDoc {
  _id: Watcher;
  /** Opaque identity of what's being watched (e.g. a directory path). */
  subject: Subject;
  /** Last known snapshot — compared against to detect changes. */
  lastSnapshot: string;
}

interface ChangeDoc {
  _id: Change;
  watcher: Watcher;
  detectedAt: string;
  snapshot: string;
}

/**
 * Watching [Subject]
 *
 * **purpose** detect when a subject's state has changed since it was last
 *   observed
 *
 * **principle** after a watcher is created with an initial snapshot, polling
 *   with a new snapshot records a change event when the snapshots differ
 *
 * **state**
 *   a set of Watchers with a subject, a last known snapshot
 *   a set of Changes with a watcher, detection timestamp, and snapshot
 */
export default class WatchingConcept {
  private watchers = new Map<Watcher, WatcherDoc>();
  private changes = new Map<Change, ChangeDoc>();

  /**
   * create ({ subject, initialSnapshot? }): ({ watcher })
   *
   * **requires** true
   *
   * **effects** creates a new watcher for the given subject with an optional
   *   initial snapshot (defaults to empty string)
   */
  async create({
    subject,
    initialSnapshot,
  }: {
    subject: Subject;
    initialSnapshot?: string;
  }): Promise<{ watcher: Watcher }> {
    const id = freshID();
    this.watchers.set(id, {
      _id: id,
      subject,
      lastSnapshot: initialSnapshot ?? "",
    });
    return { watcher: id };
  }

  /**
   * poll ({ watcher, currentSnapshot }): ({ change?, unchanged })
   *
   * **requires** `watcher` is an existing watcher
   *
   * **effects** compares `currentSnapshot` against the stored `lastSnapshot`.
   *   If they differ, records a change event, updates the stored snapshot, and
   *   returns the change identity. If they match, returns `{ unchanged: true }`.
   */
  async poll({
    watcher,
    currentSnapshot,
  }: {
    watcher: Watcher;
    currentSnapshot: string;
  }): Promise<
    | { change: Change; snapshot: string }
    | { unchanged: true }
    | { error: string }
  > {
    const doc = this.watchers.get(watcher);
    if (!doc) return { error: `Watcher not found: ${watcher}` };

    if (doc.lastSnapshot === currentSnapshot) {
      return { unchanged: true };
    }

    const changeId = freshID();
    const changeDoc: ChangeDoc = {
      _id: changeId,
      watcher,
      detectedAt: new Date().toISOString(),
      snapshot: currentSnapshot,
    };
    this.changes.set(changeId, changeDoc);

    doc.lastSnapshot = currentSnapshot;

    return { change: changeId, snapshot: currentSnapshot };
  }

  /**
   * remove ({ watcher }): ({ watcher }) | ({ error })
   *
   * **requires** `watcher` is an existing watcher
   *
   * **effects** removes the watcher and all its recorded changes
   */
  async remove({
    watcher,
  }: {
    watcher: Watcher;
  }): Promise<{ watcher: Watcher } | { error: string }> {
    if (!this.watchers.has(watcher)) {
      return { error: `Watcher not found: ${watcher}` };
    }
    this.watchers.delete(watcher);
    for (const [id, change] of this.changes) {
      if (change.watcher === watcher) this.changes.delete(id);
    }
    return { watcher };
  }

  /**
   * _getChanges ({ watcher }): ({ change, detectedAt, snapshot })
   *
   * **requires** `watcher` is an existing watcher
   *
   * **effects** returns all recorded changes for the watcher, most recent first
   */
  async _getChanges({
    watcher,
  }: {
    watcher: Watcher;
  }): Promise<{ change: Change; detectedAt: string; snapshot: string }[]> {
    return [...this.changes.values()]
      .filter((c) => c.watcher === watcher)
      .sort(
        (a, b) =>
          new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
      )
      .map((c) => ({
        change: c._id,
        detectedAt: c.detectedAt,
        snapshot: c.snapshot,
      }));
  }

  /**
   * _getWatcher ({ watcher }): ({ subject, lastSnapshot })
   *
   * **requires** `watcher` is an existing watcher
   *
   * **effects** returns the watcher's subject and last known snapshot
   */
  async _getWatcher({
    watcher,
  }: {
    watcher: Watcher;
  }): Promise<{ subject: Subject; lastSnapshot: string }[]> {
    const doc = this.watchers.get(watcher);
    if (!doc) return [];
    return [{ subject: doc.subject, lastSnapshot: doc.lastSnapshot }];
  }
}
