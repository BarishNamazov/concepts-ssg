import { freshID } from "@utils/id.ts";
import type { ID } from "@utils/types.ts";

type Subject = ID;
type Watcher = ID;
type Change = ID;
type Context = string;

interface WatcherDoc {
  _id: Watcher;
  subject: Subject;
  context: Context | null;
  lastSnapshot: string;
  status: "ACTIVE" | "STOPPED";
}

interface ChangeDoc {
  _id: Change;
  watcher: Watcher;
  detectedAt: string;
  snapshot: string;
}

/**
 * Filesystem watch driver — injected by the app factory so Watching remains
 * independent of Bun/node:fs.  Tests supply a fake driver for determinism.
 */
export interface WatchDriver {
  snapshot(subject: string): Promise<string>;
  subscribe(subject: string, onSignal: () => void): () => void;
}

/**
 * Watching [Subject, Context]
 *
 * **purpose** detect when a subject's state has changed since it was last
 *   observed, and support active subscriptions so changes enter the sync
 *   engine as journaled actions
 *
 * **principle** after a watcher is created with an initial snapshot, polling
 *   with a new snapshot records a change event when the snapshots differ;
 *   active watchers can subscribe to a driver so changes are raised
 *   automatically
 *
 * **state**
 *   a set of Watchers with
 *     a subject Subject
 *     an optional context Context
 *     a last known snapshot String
 *     a status of ACTIVE or STOPPED
 *   a set of Changes with
 *     a watcher Watcher
 *     a detection timestamp DateTime
 *     a snapshot String
 */
export default class WatchingConcept {
  private watchers = new Map<Watcher, WatcherDoc>();
  private changes = new Map<Change, ChangeDoc>();
  private unsubscribers = new Map<Watcher, () => void>();
  private activeTimers = new Map<Watcher, ReturnType<typeof setTimeout>>();
  private driver?: WatchDriver;
  public pollEmitter?: (input: {
    watcher: Watcher;
    currentSnapshot: string;
  }) => Promise<unknown>;

  constructor(
    _namespace?: string,
    driver?: WatchDriver,
    pollEmitter?: (input: {
      watcher: Watcher;
      currentSnapshot: string;
    }) => Promise<unknown>,
  ) {
    this.driver = driver;
    this.pollEmitter = pollEmitter;
  }

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
   * start ({ subject, context?, debounceMs? }): ({ watcher, subject, context })
   *
   * **requires** true
   *
   * **effects** creates a new ACTIVE watcher.  When a driver is available,
   *   takes an initial snapshot and subscribes to filesystem events, calling
   *   `poll` via the pollEmitter on each change (debounced by `debounceMs`).
   *   Returns the watcher together with its subject and context.
   */
  async start({
    subject,
    context,
    debounceMs,
  }: {
    subject: Subject;
    context?: Context;
    debounceMs?: number;
  }): Promise<
    | { watcher: Watcher; subject: Subject; context: Context | null }
    | { error: string }
  > {
    const id = freshID();
    this.watchers.set(id, {
      _id: id,
      subject,
      context: context ?? null,
      lastSnapshot: "",
      status: "ACTIVE",
    });

    if (this.driver) {
      try {
        const snap = await this.driver.snapshot(subject as string);
        const doc = this.watchers.get(id);
        if (doc) doc.lastSnapshot = snap;
      } catch {
        // Driver might not support snapshot; start with empty
      }

      const driver = this.driver;
      const subscribe = driver.subscribe;
      const emit = this.pollEmitter;

      if (emit) {
        const delay = debounceMs ?? 150;
        const unsubscribe = subscribe(subject as string, () => {
          const active = this.activeTimers.get(id);
          if (active) clearTimeout(active);

          const timer = setTimeout(async () => {
            this.activeTimers.delete(id);
            try {
              const currentSnapshot = await driver.snapshot(subject as string);
              await emit({ watcher: id, currentSnapshot });
            } catch {
              // Best effort — ignore snapshot failures during watch
            }
          }, delay);

          this.activeTimers.set(id, timer);
        });

        this.unsubscribers.set(id, unsubscribe);
      }
    }

    return { watcher: id, subject, context: context ?? null };
  }

  /**
   * poll ({ watcher, currentSnapshot }): ({ change, watcher?, subject?, context? }) | ({ unchanged })
   *
   * **requires** `watcher` is an existing watcher
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
   * stop ({ watcher }): ({ watcher }) | ({ error })
   *
   * **requires** `watcher` is an existing watcher in ACTIVE status
   *
   * **effects** unsubscribes from the driver (if any), clears active timers,
   *   marks the watcher as STOPPED, and removes all its recorded changes
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

    const unsubscribe = this.unsubscribers.get(watcher);
    if (unsubscribe) {
      unsubscribe();
      this.unsubscribers.delete(watcher);
    }

    const timer = this.activeTimers.get(watcher);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(watcher);
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
   * **effects** removes the watcher and all its recorded changes.  If the
   *   watcher is active, unsubscribes from the driver first.
   */
  async remove({
    watcher,
  }: {
    watcher: Watcher;
  }): Promise<{ watcher: Watcher } | { error: string }> {
    if (!this.watchers.has(watcher)) {
      return { error: `Watcher not found: ${watcher}` };
    }

    const unsubscribe = this.unsubscribers.get(watcher);
    if (unsubscribe) {
      unsubscribe();
      this.unsubscribers.delete(watcher);
    }

    const timer = this.activeTimers.get(watcher);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(watcher);
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
   * _getWatcher ({ watcher }): ({ subject, lastSnapshot, context, status })
   */
  async _getWatcher({ watcher }: { watcher: Watcher }): Promise<
    {
      subject: Subject;
      lastSnapshot: string;
      context: Context | null;
      status: string;
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
