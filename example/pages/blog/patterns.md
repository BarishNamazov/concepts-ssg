---
title: Patterns for Concept Composition
layout: Blog
date: 2026-05-28
collections: posts
description: Common patterns that emerge when composing concepts with synchronizations — threading, fan-out, error propagation, and batch barriers.
---

## Patterns for Concept Composition

After building several applications with Concept Design, certain patterns emerge. Here are the most useful ones.

### Pattern 1: Threading Identity

When you need a concept to track work across multiple syncs, thread an identity through the action chain. Each action receives the identity as an opaque field, ignores it semantically, and returns it in its output.

```typescript
// BuildCommand passes 'command' through Filing.scan
then: actions([
  Filing.scan, { directory, command },
])

// Error sync captures it from the scan input
when: actions([Filing.scan, { command }, { error }])
then: actions([Commanding.fail, { command, error }])
```

The `command` field is opaque to `Filing` — it's just a string it passes through. But the syncs use it to associate errors with the originating command.

### Pattern 2: Fan-Out With Query

When an action produces a list and each item needs individual processing, use `.query()` or `.flatMap()` in the `where` clause:

```typescript
where: (frames) =>
  frames.flatMap((frame) => {
    const ids = frame[entries] as string[];
    return ids.map((id) => ({ ...frame, [entry]: id }));
  }),
then: actions([Filing.read, { entry }]),
```

Each frame fans out into N frames (one per entry). The `then` clause fires once per surviving frame.

### Pattern 3: Error Propagation

Don't use `{}` as a catch-all output pattern. Match explicit success and failure:

```typescript
// Success sync — only matches successful scans
when: actions([Filing.scan, {}, { entries }])

// Error sync — only matches failed scans with command
when: actions([Filing.scan, { command }, { error }])
```

The empty `{}` input pattern matches any input. But the output pattern discriminates: `{ entries }` for success, `{ error }` for failure.

### Pattern 4: Join on Shared Identity

When two actions must complete before a third fires, bind the shared identity in both `when` clauses:

```typescript
when: actions(
  [Formatting.render, {}, { entry }],
  [Routing.derive, { entry }, {}],    // binds entry explicitly
)
```

Without `{ entry }` in the second clause, the sync would match any route derivation, not just the one for the same entry.

### Pattern 5: Batch Barrier

When you need to wait for all items in a batch to complete before proceeding, use a completion action:

```typescript
// After all scans and processing, fire Building.complete
then: actions(
  [Filing.scan, { layouts }],
  [Filing.scan, { content }],
  [Building.complete, { build }],
)

// Index regen only fires after all content is processed
when: actions([Building.complete, {}, {}])
```

The engine processes `then` actions sequentially. Each action's cascading syncs complete before the next `then` action starts. So `Building.complete` is guaranteed to fire after all content has been scanned, read, parsed, rendered, routed, and written.

### Pattern 6: Query Responsibly

Query methods (`_`-prefixed) must always return arrays. They should never mutate state. Keep them pure — a query called twice with the same arguments should return the same result (assuming no intervening mutations).
