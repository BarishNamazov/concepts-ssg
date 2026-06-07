---
title: Composition Patterns in This Project
layout: Blog
date: 2026-06-02
collections: posts
description: "The recurring sync patterns in this repo — fan-out, join, barrier, context threading, aggregation, and error shapes — with real code."
---

## Composition Patterns in This Project

The sync layer uses a small set of patterns repeatedly. This post documents each pattern with code from the actual sync files.

## Pattern 1: Fan Out an Array

A concept returns an array of IDs. The sync turns one frame into many, one per ID.

**The problem:** `Filing.scan` returns `{ entries: ["entry-1", "entry-2", ..., "entry-N"] }`. `Filing.read` takes a single entry ID. The engine does not automatically iterate arrays.

**The sync** (`discovery.sync.ts`):

```ts
export const ScanTriggersRead: Sync = ({ entry, entries }) => ({
  when: actions([Filing.scan, {}, { entries }]),
  where: (frames) =>
    frames.flatMap((frame) => {
      const entryIds = frame[entries] as string[];
      return entryIds.map((id) => ({ ...frame, [entry]: id }));
    }),
  then: actions([Filing.read, { entry }]),
});
```

If the scan found 20 files, `then` fires `Filing.read` 20 times — once per entry.

**Where it bends:** The engine currently marks a journal record as consumed after any match, so fan-out syncs that reference the original scan result in `where` queries can fail if another sync already consumed it.

## Pattern 2: Join on an Opaque ID

Two independent actions produce results for the same entity. A third action needs both results.

**The problem:** `Formatting.render` produces HTML. `Routing.derive` produces a URL. `Layouting.apply` needs both for the same entry. Rendering and routing happen in parallel after parsing.

**The sync** (`templates.sync.ts`):

```ts
export const RenderAndRouteTriggersApply: Sync = ({ entry }) => ({
  when: actions(
    [Formatting.render, {}, { entry }],
    [Routing.derive, { entry }, {}],
  ),
  where: async (frames) => {
    frames = await frames.query(Formatting._getHtml, { entry }, { html });
    frames = await frames.query(Routing._getRoute, { entry }, { route });
    return frames;
  },
  then: actions([Layouting.apply, { entry, html, route }]),
});
```

The shared `entry` binding is the join key. Both `when` clauses must match the same value for `entry`. If routing hasn't fired yet for this entry, the sync waits.

## Pattern 3: Barrier Action

Some work depends on every entry being processed. A barrier action signals "all entries done."

**The problem:** The blog index lists all posts in the `posts` collection. It cannot render until every post has been collected.

**The barrier:** `Building.complete` fires after all scans and per-file cascades finish (or rather, after scans finish — a known flaw).

**The sync** (`templates.sync.ts`):

```ts
export const FinalizeTriggersIndexRegen: Sync = ({}) => ({
  when: actions([Building.complete, {}, {}]),
  where: async (frames) => {
    // query Collecting for all entries per collection
    // find pages with type: index
    // package collection entries into template data
    return frames;
  },
  then: actions([Layouting.apply, { entry, collectionData }]),
});
```

**Where it bends:** `Building.complete` can fire after earlier actions returned errors, so the barrier is unreliable.

## Pattern 4: Thread Context Through Actions

Several actions carry a `command` parameter so error syncs can correlate failures back to the command that started the work.

```ts
// In build.sync.ts, the command ID is threaded through:
Filing.scan({ command, root, glob })
```

Later, an error sync matches on the error output and fails the command:

```ts
export const ScanErrorFailsBuild: Sync = ({ command, error }) => ({
  when: actions([Filing.scan, { command }, { error }]),
  then: actions([Commanding.fail, { command, error }]),
});
```

**Where it bends:** Many actions that can fail are invoked without `command`, so their errors cannot reach the error sync. This is tracked in [Sync Layer issues](/issues/sync-layer).

## Pattern 5: Aggregate Frames Explicitly

When a sync needs one summary from many frames, it collapses them.

**The sync** (`reporting.sync.ts`):

```ts
export const BuildReportStats: Sync = ({}) => ({
  when: actions([Building.complete, {}, {}]),
  where: async (frames) => {
    return frames.collectAs({}) // collapse all frames into one
  },
  then: async (frame) => {
    // query all filing entries, count by source tag
    // issue CommandLine.notice with summary
  },
});
```

`collectAs` groups frames into batches. The result is one aggregate frame instead of N individual ones.

## Pattern 6: Error Output Shapes

Success and failure are distinguished by output shape, not by status codes or exceptions.

```ts
// Success: matched by { entries }
when: actions([Filing.scan, {}, { entries }])

// Failure: matched by { error }
when: actions([Filing.scan, { command }, { error }])
```

Because the engine matches on output shape, a success sync never accidentally fires on a failure. The two patterns are mutually exclusive.

**Where it bends:** Error outputs need enough context for downstream handling. A render error without a `command` binding cannot be propagated to `Commanding.fail`.

## Next

Read the [Friction Log](/blog/friction-log) for the catalog of where these patterns break down in practice.
