---
title: Friction Log
layout: Blog
date: 2026-06-01
collections: posts
description: "Where the concept-design model is useful, where this implementation bends, and what the issue review says to fix."
---

## Friction Log

Concept design gives this project a clear architecture: independent concepts, explicit syncs, journaled state. But the design is an ideal, and the implementation has sharp edges. This post is the narrative form of the issue review.

## Friction 1: Then Actions Do Not Gate on Success

The most important lesson: a list of `then` actions is not a transaction. If `Filing.scan` returns `{ error: "directory not found" }`, the build sync still fires `Building.complete`, `Filing.cleanOutput`, and `Commanding.succeed`.

A build can fail to scan, read, render, or write files — and still report success. Destructive cleanup can run against an incomplete output. The sync layer needs explicit stage gates: "only proceed to the next stage if the previous stage succeeded."

See [Sync Layer Issues](/issues/sync-layer).

## Friction 2: The Engine's Evidence Model Is Too Coarse

The sync engine tracks which journal records have been consumed by which sync names. But the key is just the sync name — not which specific action IDs were matched.

This means a record consumed by one sync firing cannot participate in a later firing of the same sync, even with different partner records. Valid fan-out patterns can be silently skipped.

Evidence is also consumed before the `then` action runs. If the `then` action fails (throws), the evidence is gone and cannot be retried.

The fix is to store consumed match signatures: `sync name + ordered action IDs`, and only mark consumed after `then` succeeds.

See [Engine Core Issues](/issues/engine-core).

## Friction 3: Runtime Feedback Needs Explicit Boundaries

The dev loop has improved: public assets copy bytes safely, clean URLs receive the live-reload script, and rapid file changes are serialized through `Coalescing` instead of starting overlapping builds.

The remaining runtime sharp edge is startup and failure cleanup. Starting the server, watchers, and initial build still spans several effects, so partial startup failures need more explicit cleanup rules.

See [Sync Layer Issues](/issues/sync-layer).

## What Still Works

The model pays off in the core path. The project is readable because:

- Concepts own narrow, testable state machines
- Syncs declare relationships instead of calling functions
- The example site exercises everything in one loop
- The issue log makes design debt visible rather than hidden

The friction log is a repair list, not a rejection.

## Fix Order

If you are hardening the project, start here:

 1. **Gate build success behind stage success.** Split build stages into success-only syncs.
 2. **Harden dev startup cleanup.** Chain startup stages and stop resources on partial failure.
 3. **Fix engine evidence tracking.** Use match signatures instead of per-sync-name consumption.

The full issue map starts at [Issue Review](/issues).
