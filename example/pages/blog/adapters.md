---
title: The Adapter Pattern for Pure Concepts
layout: Blog
date: 2026-06-07
collections: posts
description: "How runtime adapters keep concepts pure, testable, and independent by moving platform side effects to a separate boundary."
---

## The Adapter Pattern for Pure Concepts

Concepts in this repo are pure state machines. `CommandLine.fail` marks an invocation as FAILED. `Watching.poll` compares two snapshot strings. `Serving.start` records a server document. None of them touch `console.log`, `process.exitCode`, filesystem watchers, or timers.

But the application *needs* those things. Someone has to print the failure message. Someone has to watch the directory for changes. Someone has to set the exit code.

The answer is a **runtime adapter** — a deliberate boundary that owns the platform concern while the concept owns only the state.

## Two Adapters, Two Problems

The repo ships two adapters that solve different problems with the same pattern.

### CommandLineRuntimeAdapter: Print and Exit

Before the adapter existed, `CommandLineConcept` did this:

```ts
// Old, impure CommandLineConcept
async succeed(...) {
  doc.status = "SUCCEEDED";
  if (message) console.log(message);
  process.exitCode = 0;
  return { invocation };
}
```

This made the concept untestable without mocking `console` and `process`. It also meant the concept knew about Node.js — impossible to reuse in a browser-based SSG or a test runner that needs a different exit strategy.

The fix was three pieces:

**The concept** goes pure. It stores state, returns structured output, and never touches the platform:

```ts
// src/concepts/CommandLine/CommandLineConcept.ts
async succeed(...) {
  doc.status = "SUCCEEDED";
  if (message) doc.message = message;
  return { invocation, message: message };
}
```

**The adapter** owns the platform effects. It receives the concept's output and does the printing:

```ts
// src/runtime/command_line_runtime_adapter.ts
async succeed({ invocation, message }) {
  if (message !== "") this.effects.log(message);
  this.effects.setExitCode(0);
  return { invocation };
}
```

**A sync** bridges them. When the concept transitions, the adapter follows:

```ts
// src/syncs/runtime-cli.sync.ts
const RuntimeCliSucceed: Sync = ({ invocation, message }) => ({
  when: actions([CommandLine.succeed, {}, { invocation, message }]),
  then: actions([CommandLineRuntime.succeed, { invocation, message }]),
});
```

The concept has no idea the adapter exists. The adapter has no state of its own — it's a thin wrapper over `console` and `process`. The sync connects them declaratively.

### FilesystemWatchAdapter: Watch and Poll

The `Watching` concept is generic. It compares snapshots and records changes. It stores watchers with subjects and contexts. It has no idea what a "file" is.

```ts
// WatchingConcept — pure snapshot comparison
async poll({ watcher, currentSnapshot }) {
  if (doc.lastSnapshot === currentSnapshot) return { unchanged: true };
  // record change, update snapshot, return { change, watcher, subject, context }
}
```

But someone needs to take actual filesystem snapshots, subscribe to platform events, and debounce rapid changes. That's the adapter:

```ts
// src/runtime/filesystem_watch_adapter.ts
export class FilesystemWatchAdapter {
  constructor(
    private readonly driver: FilesystemWatchDriver,  // platform
    private readonly Watching: WatchingRuntimeActions, // concept
    private readonly debounceMs = 150,
  ) {}

  schedulePoll(watcher, subject) {
    // Check watcher is still active (guards against stale timer callbacks)
    if (!(await this.isActive(watcher))) return;

    // Take a real filesystem snapshot
    const snapshot = await this.driver.snapshot(subject);

    // Check AGAIN — state may have changed during the async snapshot call
    if (!(await this.isActive(watcher))) return;

    // Push snapshot into the pure concept
    await this.Watching.poll({ watcher, currentSnapshot: snapshot.snapshot });
  }
}
```

The adapter owns:
- The platform driver (`FilesystemWatchDriver` — OS-specific watch primitives)
- Debounce timers (`setTimeout`, `clearTimeout`)
- Active-status checks before and after async calls
- Error handling (`driver.snapshot` failures → `Watching.fail`)

The concept owns:
- Snapshot comparison logic
- Change recording
- Watcher lifecycle state (ACTIVE / STOPPED / FAILED)

## Why the Double Check Matters

The adapter checks `isActive(watcher)` twice — once before the snapshot and once after. Between those two checks, another sync could have called `Watching.stop`, yet the timer callback would still be in flight.

Without the guard, stopped watchers could still trigger rebuilds. With it, the adapter reads the concept's state and bails if the watcher is no longer active.

This is the kind of race condition that only exists at the boundary between a deterministic concept and an event-driven platform. The adapter is the right place to handle it.

## What the Pattern Buys You

**1. Concepts test in pure memory.**

No `mock('fs')`. No `jest.spyOn(console, 'log')`. No `process.exitCode` assertions. Every concept test in this repo creates a fresh instance, calls actions, and reads state — no side effects to clean up.

```ts
// From CommandLineConcept.test.ts
test("succeed transitions to SUCCEEDED and stores message", async () => {
  const result = await CommandLine.succeed({ invocation, message: "Done." });
  if ("error" in result) throw new Error(result.error);
  expect(result.message).toBe("Done.");

  const [doc] = await CommandLine._getInvocation({ invocation });
  expect(doc.status).toBe("SUCCEEDED");
  // No process.exitCode check — that's the adapter's job
});
```

**2. Platform concerns are isolated and swappable.**

The `CommandLineRuntimeAdapter` takes an `effects` parameter. Tests can inject a no-op effects implementation. Production injects `console`. The adapter doesn't even know it's the "real" one.

**3. The concept stays reusable outside the CLI.**

`Watching` doesn't know about files. It compares arbitrary snapshot strings. You could reuse it to watch database records, HTTP endpoints, or in-memory structures — just provide a different driver and adapter.

**4. The boundary becomes a single point of reasoning.**

Race conditions, debounce timing, I/O errors, and platform quirks live in the adapter. The concept's state machine can be reasoned about independently. When a bug appears, you know which side of the boundary to look at.

## The Pattern in One Diagram

```
Sync layer:   CommandLine.succeed ──→ CommandLineRuntime.succeed
                    │                         │
                    │ (pure state)             │ (platform effects)
                    ▼                         ▼
Concept:      "status: SUCCEEDED"       console.log("Done.")
                                          process.exitCode = 0
```

The concept and adapter never call each other. Syncs make the connection, and both sides remain independently testable and independently replaceable.
