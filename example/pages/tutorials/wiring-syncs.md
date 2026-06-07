---
title: Wiring Concepts With Syncs
layout: Tutorial
date: 2026-06-04
collections: tutorials
description: Learn how to wire concepts together using the when/where/then pattern, including fan-out, error handling, and batch barriers.
---

## Wiring Concepts With Syncs

Now that you have concepts, let's wire them together with synchronizations.

### The Basic Pattern

A sync has three parts:

```typescript
export const MySync: Sync = ({ var1, var2 }) => ({
  when: actions([
    SomeConcept.someAction,
    { inputPattern },    // match these input fields
    { outputPattern },   // match these output fields, bind symbols
  ]),
  where: async (frames) => {
    // Transform frames: filter, query, map, fan-out
    return frames;
  },
  then: actions([
    AnotherConcept.anotherAction,
    { inputFromBoundSymbols },
  ]),
});
```

### Example: Scan Triggers Read

```typescript
export const ScanTriggersRead: Sync = ({ entry, entries }) => ({
  // Match Filing.scan, capture the 'entries' array from output
  when: actions([Filing.scan, {}, { entries }]),

  // Fan out: one frame per entry ID
  where: (frames) =>
    frames.flatMap((frame) => {
      const entryIds = frame[entries] as string[];
      return entryIds.map((id) => ({ ...frame, [entry]: id }));
    }),

  // Fire Filing.read for each entry
  then: actions([Filing.read, { entry }]),
});
```

### Example: Error Handling

```typescript
export const ScanErrorFailsBuild: Sync = ({ command, error }) => ({
  // Match scan failures that carry a command ID in input
  when: actions([Filing.scan, { command }, { error }]),

  // Fail the command
  then: actions([Commanding.fail, { command, error }]),
});
```

Notice the input pattern `{ command }` — this only matches scans that were initiated by a build command (which passes `command` through). Direct scan calls without `command` won't trigger the error sync.

### Key Rules

1. **Symbols are logic variables.** `$vars` is a Proxy — `const { entry } = $vars` creates a unique symbol bound to the string `"entry"`.

2. **Input patterns unify.** Symbols bind on first encounter. If already bound, the value must match exactly (strict equality).

3. **Output patterns discriminate.** `{ entries }` only matches success outputs. `{ error }` only matches error outputs. They never conflict.

4. **Queries are fan-out.** `frames.query(concept._query, inputMap, outputMap)` calls the query for each frame. Zero rows → frame dropped. N rows → N new frames.

5. **Then actions fire per frame.** If `where` produces 5 frames, `then` actions fire 5 times. If `where` returns empty, `then` never fires.

6. **Flow is inherited.** Actions fired from `then` inherit the triggering action's flow token. This keeps independent invocations isolated.

### Testing Syncs

```typescript
test("scan cascades to parse", async () => {
  const app = createConcepts();        // fresh isolated concepts
  const syncs = createSyncs(app);      // create syncs with those concepts
  app.Engine.register(syncs);         // register

  await writeFile("test.md", "---\ntitle: Hello\n---\nBody");
  await app.Filing.scan({ ... });

  const fields = await app.Frontmattering._getAllFields(...);
  expect(fields[0].fields.title).toBe("Hello");
});
```

Each test creates fresh concept instances — no state leaks between tests.
