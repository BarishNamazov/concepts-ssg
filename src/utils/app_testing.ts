import { MongoMemoryServer } from "mongodb-memory-server";

/**
 * Boots the full application — every concept and every synchronization — against
 * a disposable in-memory MongoDB, exactly as `main.ts` would against a real one.
 *
 * It injects the database connection through the environment **before** importing
 * the generated `@concepts`/`@syncs` barrels, so the production singletons (which
 * the synchronizations close over) are wired to the in-memory database. This is
 * what makes the real syncs observable in tests.
 *
 * Because the barrels are module singletons, all synchronization integration
 * tests must share a single `setupApp()` (one per test process). Run
 * `bun run build` first so the barrels exist.
 */
export interface TestApp {
  /**
   * Drives a request end-to-end through the engine just like the HTTP server:
   * fires `Requesting.request` and awaits the matching `Requesting.respond`.
   */
  send: (path: string, body?: Record<string, unknown>) => Promise<any>;
  /** The instrumented concept singletons (and `Engine`), for direct assertions. */
  concepts: Record<string, any>;
  /** Drops every collection so the next test starts from a clean slate. */
  reset: () => Promise<void>;
  /** Tears down the in-memory MongoDB. */
  stop: () => Promise<void>;
}

let shared: Promise<TestApp> | undefined;

/**
 * Returns a process-wide singleton app. The generated barrels are module
 * singletons, so every integration test in a process must share one instance;
 * isolate individual tests with `reset()` in a `beforeEach` hook.
 */
export function setupApp(): Promise<TestApp> {
  return (shared ??= boot());
}

async function boot(): Promise<TestApp> {
  const server = await MongoMemoryServer.create();
  process.env.MONGODB_URL = server.getUri();
  process.env.DB_NAME = "forum-test";
  process.env.REQUESTING_SAVE_RESPONSES = "false";

  const { Logging } = await import("@engine");
  const concepts = await import("@concepts");
  const syncs = (await import("@syncs")).default;
  concepts.Engine.logging = Logging.OFF;
  concepts.Engine.register(syncs);

  const { Requesting, db, client } = concepts as any;

  const send = async (path: string, body: Record<string, unknown> = {}) => {
    const { request } = await Requesting.request({ ...body, path });
    const [{ response }] = await Requesting._awaitResponse({ request });
    return response;
  };

  const reset = async () => {
    for (const c of await db.listCollections().toArray()) {
      await db.collection(c.name).deleteMany({});
    }
  };

  const stop = async () => {
    shared = undefined;
    await client.close();
    await server.stop();
  };

  return { send, concepts: concepts as Record<string, any>, reset, stop };
}
