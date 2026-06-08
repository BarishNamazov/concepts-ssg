import { freshID } from "@utils/id.ts";
import type { ID } from "@utils/types.ts";

type Subject = ID;
type Watcher = ID;
type Change = ID;
type Context = string;
type WatcherStatus = "ACTIVE" | "STOPPED" | "FAILED";

interface WatcherDoc {
  _id: Watcher;
  subject: Subject;
  context: Context | null;
  lastSnapshot: string;
  status: WatcherStatus;
  error?: string;
}

interface ChangeDoc {
  _id: Change;
  watcher: Watcher;
  detectedAt: string;
  snapshot: string;
}

/**
 * Watching [Subject, Context]
 *
 * **purpose** detect when a subject's state has changed since it was last
 *   observed
 *
 * **principle** after a watcher is started with an initial snapshot, polling
 *   with a new snapshot records a change event when the snapshots differ;
 *   polling with the same snapshot reports no change
 *
 * **state**
 *   a set of Watchers with
 *     a subject Subject
 *     an optional context Context
 *     a last known snapshot String
 *     a status of ACTIVE or STOPPED or FAILED
 *     an optional error String
 *   a set of Changes with
 *     a watcher Watcher
 *     a detection timestamp DateTime
 *     a snapshot String
 */
export default class WatchingConcept {
  private watchers = new Map<Watcher, WatcherDoc>();
  private changes = new Map<Change, ChangeDoc>();

  /**
   * create ({ subject, initialSnapshot? }): ({ watcher })
   *
   * **requires** true
   *
   * **effects** creates a new STOPPED watcher for the given subject with an
   *   optional initial snapshot (defaults to empty string)
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
      context: null,
      lastSnapshot: initialSnapshot ?? "",
      status: "STOPPED",
    });
    return { watcher: id };
  }

  /**
   * start ({ subject, context?, initialSnapshot? }): ({ watcher, subject, context })
   *
   * **requires** true
   *
   * **effects** creates a new ACTIVE watcher for the given subject with an
   *   optional initial snapshot (defaults to empty string). Returns the watcher
   *   together with its subject and context.
   */
  async start({
    subject,
    context,
    initialSnapshot,
  }: {
    subject: Subject;
    context?: Context;
    initialSnapshot?: string;
  }): Promise<{ watcher: Watcher; subject: Subject; context: Context | null }> {
    const id = freshID();
    this.watchers.set(id, {
      _id: id,
      subject,
      context: context ?? null,
      lastSnapshot: initialSnapshot ?? "",
      status: "ACTIVE",
    });

    return { watcher: id, subject, context: context ?? null };
  }

  /**
   * observe ({ watcher, snapshot }): ({ watcher }) | ({ error })
   *
   * **requires** `watcher` is an existing watcher in ACTIVE status
   *
   * **effects** records `snapshot` as the watcher's last known snapshot without
   *   creating a change event
   */
  async observe({
    watcher,
    snapshot,
  }: {
    watcher: Watcher;
    snapshot: string;
  }): Promise<{ watcher: Watcher } | { error: string }> {
    const doc = this.watchers.get(watcher);
    if (!doc) return { error: `Watcher not found: ${watcher}` };
    if (doc.status !== "ACTIVE") {
      return { error: `Watcher not active: ${watcher}` };
    }

    doc.lastSnapshot = snapshot;
    return { watcher };
  }

  /**
   * poll ({ watcher, currentSnapshot }): ({ change, watcher?, subject?, context? }) | ({ unchanged }) | ({ error })
   *
   * **requires** `watcher` is an existing watcher in ACTIVE status
   *
   * **effects** compares `currentSnapshot` against the stored `lastSnapshot`.
   *   If they differ, records a change event, updates the stored snapshot, and
   *   returns the change identity together with the watcher's subject and
   *   context. If they match, returns `{ unchanged: true }`.
   */
  async poll({
    watcher,
    currentSnapshot,
  }: {
    watcher: Watcher;
    currentSnapshot: string;
  }): Promise<
    | {
        change: Change;
        watcher: Watcher;
        subject: Subject;
        context: Context | null;
        snapshot: string;
      }
    | { unchanged: true }
    | { error: string }
  > {
    const doc = this.watchers.get(watcher);
    if (!doc) return { error: `Watcher not found: ${watcher}` };
    if (doc.status !== "ACTIVE") {
      return { error: `Watcher not active: ${watcher}` };
    }

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

    return {
      change: changeId,
      watcher,
      subject: doc.subject,
      context: doc.context,
      snapshot: currentSnapshot,
    };
  }

  /**
   * fail ({ watcher, error }): ({ watcher, subject, context, error }) | ({ error })
   *
   * **requires** `watcher` is an existing watcher
   *
   * **effects** marks the watcher as FAILED and records the failure message
   */
  async fail({ watcher, error }: { watcher: Watcher; error: string }): Promise<
    | {
        watcher: Watcher;
        subject: Subject;
        context: Context | null;
        error: string;
      }
    | { error: string }
  > {
    const doc = this.watchers.get(watcher);
    if (!doc) return { error: `Watcher not found: ${watcher}` };

    doc.status = "FAILED";
    doc.error = error;

    return {
      watcher,
      subject: doc.subject,
      context: doc.context,
      error,
    };
  }

  /**
   * stop ({ watcher }): ({ watcher }) | ({ error })
   *
   * **requires** `watcher` is an existing watcher in ACTIVE status
   *
   * **effects** marks the watcher as STOPPED and removes all its recorded
   *   changes
   */
  async stop({
    watcher,
  }: {
    watcher: Watcher;
  }): Promise<{ watcher: Watcher } | { error: string }> {
    const doc = this.watchers.get(watcher);
    if (!doc) return { error: `Watcher not found: ${watcher}` };

    if (doc.status !== "ACTIVE") {
      return { error: `Watcher not active: ${watcher}` };
    }

    doc.status = "STOPPED";

    for (const [id, change] of this.changes) {
      if (change.watcher === watcher) this.changes.delete(id);
    }

    return { watcher };
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
   * _getWatcher ({ watcher }): ({ subject, lastSnapshot, context, status, error? })
   */
  async _getWatcher({ watcher }: { watcher: Watcher }): Promise<
    {
      subject: Subject;
      lastSnapshot: string;
      context: Context | null;
      status: string;
      error?: string;
    }[]
  > {
    const doc = this.watchers.get(watcher);
    if (!doc) return [];
    return [
      {
        subject: doc.subject,
        lastSnapshot: doc.lastSnapshot,
        context: doc.context,
        status: doc.status,
        error: doc.error,
      },
    ];
  }

  /**
   * _getByContext ({ context }): ({ watcher, subject, status })
   *
   * **requires** true
   *
   * **effects** returns all watchers with the given context
   */
  async _getByContext({
    context,
  }: {
    context: Context;
  }): Promise<{ watcher: Watcher; subject: Subject; status: string }[]> {
    return [...this.watchers.values()]
      .filter((w) => w.context === context)
      .map((w) => ({ watcher: w._id, subject: w.subject, status: w.status }));
  }
}
