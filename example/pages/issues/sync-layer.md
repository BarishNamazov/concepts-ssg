---
title: Sync Layer Issues
layout: Blog
---

## Sync Layer Issues

These issues are in the sync files that compose concepts into the application — stage gating, failure propagation, ordering dependencies, and dev orchestration.

### ISS-002: Build can report success and clean output after failures

**Problem:** `BuildCommand` fires `Building.complete`, `Filing.cleanOutput`, and `Commanding.succeed` in the same `then` list as scan actions. Errors do not stop later `then` actions. Error syncs that try to `Commanding.fail` can race with `Commanding.succeed`.

**Why it matters:** A failed scan, read, render, route, or write can still be followed by destructive cleanup and a success report. Failed builds appear successful.

**Repair direction:** Split build stages into success-only syncs. Query that all required work succeeded before completing or cleaning. Gate cleanup on complete success.

### ISS-007: Dev startup can partially start resources

**Problem:** Dev startup starts the server, watcher, and initial build in one `then` block. There is no `WaitForReadyFail` sync. Startup errors can fail the command without notifying the CLI invocation.

**Why it matters:** Leaked watchers and servers, partially started dev environments, and invocations that stay pending.

**Repair direction:** Chain startup stages with success-only syncs. Add failure propagation. Clean up resources on partial startup failure.

### ISS-008: Dev rebuilds can overlap and corrupt state

**Problem:** Every watch event issues a new build immediately, while builds mutate process-global concept state. No in-flight build guard or coalescing.

**Why it matters:** Rapid changes interleave builds. Stale routes, missing scanned files, or cleanup from the wrong build.

**Repair direction:** Serialize builds per dev session. Coalesce change events while a build is active. Scope mutable state by build ID.

### ISS-009: Build startup does not clear all build-scoped concepts

**Problem:** Build startup clears `Filing`, `Collecting`, and `Frontmattering` but not `Formatting`, `Layouting`, or existing `Routing` entries.

**Why it matters:** Later builds can inherit removed layouts, stale rendered HTML, or stale route collisions.

**Repair direction:** Add reset actions for all build-scoped state or key records by build ID.

### ISS-026: Dev watches only source content

**Problem:** Dev mode watches the source directory, but builds also depend on layouts and public assets.

**Why it matters:** Editing a layout or static asset does not trigger rebuild or reload.

**Repair direction:** Watch all non-empty input roots. Reuse dev command context for rebuilds.

### ISS-028: No partial rebuilds or plugin boundary

**Problem:** Every change triggers a full build. Sync registration is static in `createSyncs`.

**Why it matters:** Large sites rebuild unnecessarily slowly. Extensions require editing core composition code.

**Repair direction:** Track changed entries and dependent pages for partial rebuilds. Consider a plugin registration boundary.

## Related

- [Concept Design Issues](/issues/concept-design) — independence and identity problems
- [Engine Core Issues](/issues/engine-core) — matching and evidence bugs
- [Back to Issue Review](/issues)
