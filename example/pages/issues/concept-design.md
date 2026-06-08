---
title: Concept Design Issues
layout: Blog
---

## Concept Design Issues

These issues are about concepts that carry application-specific concerns, conflate identity spaces, or store state at the wrong scope. Each one makes a concept less independent and harder to reuse.

### ISS-010: Command correlation leaks into independent concepts

**Problem:** `Building`, `Filing`, `Formatting`, `Frontmattering`, `Layouting`, `Routing`, and `Publishing` all accept a `command` parameter solely for sync correlation. `Building.start` casts the command ID into its own ID space, conflating external tokens with concept-owned identity.

**Why it matters:** Concepts become aware of app orchestration. A `Formatting` concept should not know that some application wraps it in a command lifecycle. ID collision bugs from reused external IDs can also be invisible in isolated concept tests.

**Repair direction:** Let concepts allocate their own IDs with `freshID()`. Keep command/build correlation in sync frames or a generic mapping concept.

### ISS-011: Template and collection concepts contain app-specific semantics

**Problem:** `Collecting` mentions frontmatter fields, index pages, and collection loop syntax. Syncs parse collection-loop syntax, inject `_entry`, exclude `type: index`, and sort entries — all outside a template concept.

**Why it matters:** Generic collection behavior is tied to one app's conventions and one template syntax. Adding a template feature requires changes in both syncs and layout code.

**Repair direction:** Make `Collecting` generic over membership and metadata only. Move collection loop, sort, and self-exclusion into a template concept with typed actions.

### ISS-012: Watching knows too much about filesystem/runtime

**Problem:** `Watching` is nominally generic over `Subject`, but casts subjects to strings for a filesystem driver and stores a sync-engine callback. Timer callbacks do not check active status before emitting.

**Why it matters:** Stopped watchers can still trigger rebuilds. Platform-specific watch failures bypass structured error handling. The concept is coupled to both the runtime and the engine.

**Repair direction:** Move driver subscription and engine emission to a runtime adapter. Keep `Watching` as pure snapshot comparison. Guard polls by active status.

### ISS-013: Global mutable state causes cross-instance interference

**Problem:** `Serving` stores SSE clients in a module-level `Map` shared across all instances. `Filing` has one output directory for all entries. `CommandLine` mutates `process.exitCode` inline.

**Why it matters:** Stopping one server disconnects all clients. Rebuilds can write entries with another build's output config. Tests become order-dependent.

**Repair direction:** Scope state by instance ID. Per-server clients, per-build output configs, per-entry write targets. Move process effects to a runtime adapter.

### ISS-016: Layouting conflates layout names, layout IDs, and entry IDs

**Problem:** `define` uses the layout name as a layout ID. `compose` stores composed layouts in the same `entries` map as entry compositions. Human names become identity keys.

**Why it matters:** Layout names can collide with entry IDs. The concept depends on naming conventions instead of its own identity space.

**Repair direction:** Allocate fresh layout IDs. Store `name` as a unique field. Keep layout composition state separate from entry application state.

### ISS-017: Routing derives routes from mutable global config

**Problem:** `Routing.configure` mutates config while existing routes remain in state. Prefix stripping is raw string matching. Path normalization happens after derivation.

**Why it matters:** Reconfiguring between builds leaves stale routes. Edge cases with `./`, `..`, or backslashes produce unexpected routes or collisions.

**Repair direction:** Scope config per build. Clear or rederive routes on config change. Normalize paths before prefix stripping.

### ISS-005: Publishing commit is destructive and non-atomic

**Problem:** `Publishing.commit` removes stale files before all staged artifacts are written. A write failure leaves the destination partially mutated with the publication stuck in staging.

**Why it matters:** Partial publications can be corrupt. Concurrent commits to the same destination can interleave.

**Repair direction:** Write to a temp directory, validate all artifacts, then atomically promote the complete result. Add a per-destination lock.

## Related

- [Sync Layer Issues](/issues/sync-layer) — pipeline gating and error propagation
- [Engine Core Issues](/issues/engine-core) — matching and evidence bugs
- [Back to Issue Review](/issues)
