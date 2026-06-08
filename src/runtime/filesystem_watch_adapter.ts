import type {
  FilesystemWatchDriver,
  WatchSubscription,
} from "./filesystem_watch_driver.ts";

type Watcher = string;
type Subject = string;
type Context = string | null;

export interface WatchingRuntimeActions {
  poll(input: { watcher: Watcher; currentSnapshot: string }): Promise<unknown>;
  fail(input: { watcher: Watcher; error: string }): Promise<unknown>;
  _getWatcher(input: { watcher: Watcher }): Promise<{ status: string }[]>;
}

interface RuntimeWatchDoc {
  subject: Subject;
  context: Context;
  subscription: WatchSubscription;
}

/**
 * Runtime adapter that connects filesystem events to the pure Watching concept.
 *
 * The adapter owns platform subscriptions, debounce timers, and calls to
 * instrumented Watching actions. It is intentionally outside the concept layer.
 */
export class FilesystemWatchAdapter {
  private subscriptions = new Map<Watcher, RuntimeWatchDoc>();
  private timers = new Map<Watcher, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly driver: FilesystemWatchDriver,
    private readonly Watching: WatchingRuntimeActions,
    private readonly debounceMs = 150,
  ) {}

  /**
   * subscribe ({ watcher, subject, context }): ({ watcher, subject, context, snapshot }) | ({ watcher, subject, context, error })
   *
   * **requires** `watcher` is active in Watching and `subject` names a filesystem path
   *
   * **effects** subscribes to the filesystem subject and returns the initial
   *   snapshot. Future filesystem signals are debounced and emitted as
   *   `Watching.poll` only while the watcher remains active.
   */
  async subscribe({
    watcher,
    subject,
    context,
  }: {
    watcher: Watcher;
    subject: Subject;
    context: Context;
  }): Promise<
    | { watcher: Watcher; subject: Subject; context: Context; snapshot: string }
    | { watcher: Watcher; subject: Subject; context: Context; error: string }
  > {
    if (!(await this.isActive(watcher))) {
      return {
        watcher,
        subject,
        context,
        error: `Watcher not active: ${watcher}`,
      };
    }

    const snapshot = await this.driver.snapshot(subject);
    if ("error" in snapshot) {
      return { watcher, subject, context, error: snapshot.error };
    }

    this.cleanup(watcher);

    const subscribed = this.driver.subscribe(subject, {
      signal: () => this.schedulePoll(watcher, subject),
      error: (error) => {
        void this.reportFailure(watcher, error);
      },
    });

    if ("error" in subscribed) {
      return { watcher, subject, context, error: subscribed.error };
    }

    this.subscriptions.set(watcher, {
      subject,
      context,
      subscription: subscribed.subscription,
    });

    return { watcher, subject, context, snapshot: snapshot.snapshot };
  }

  /**
   * unsubscribe ({ watcher }): ({ watcher })
   *
   * **requires** true
   *
   * **effects** cancels any timer and filesystem subscription for `watcher`
   */
  async unsubscribe({
    watcher,
  }: {
    watcher: Watcher;
  }): Promise<{ watcher: Watcher }> {
    this.cleanup(watcher);
    return { watcher };
  }

  private schedulePoll(watcher: Watcher, subject: Subject): void {
    const active = this.timers.get(watcher);
    if (active) clearTimeout(active);

    const timer = setTimeout(async () => {
      this.timers.delete(watcher);

      if (!(await this.isActive(watcher))) return;

      const snapshot = await this.driver.snapshot(subject);
      if ("error" in snapshot) {
        await this.reportFailure(watcher, snapshot.error);
        return;
      }

      if (!(await this.isActive(watcher))) return;

      await this.Watching.poll({
        watcher,
        currentSnapshot: snapshot.snapshot,
      });
    }, this.debounceMs);

    this.timers.set(watcher, timer);
  }

  private async reportFailure(watcher: Watcher, error: string): Promise<void> {
    if (!(await this.isActive(watcher))) return;
    this.cleanup(watcher);
    await this.Watching.fail({ watcher, error });
  }

  private async isActive(watcher: Watcher): Promise<boolean> {
    const [doc] = await this.Watching._getWatcher({ watcher });
    return doc?.status === "ACTIVE";
  }

  private cleanup(watcher: Watcher): void {
    const timer = this.timers.get(watcher);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(watcher);
    }

    const doc = this.subscriptions.get(watcher);
    if (doc) {
      doc.subscription.unsubscribe();
      this.subscriptions.delete(watcher);
    }
  }
}
