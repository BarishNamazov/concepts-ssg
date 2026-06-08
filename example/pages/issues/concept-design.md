---
title: Concept Design Issues
layout: Blog
---

## Concept Design Issues

These issues are about concepts that carry application-specific concerns, conflate identity spaces, or store state at the wrong scope. Each one makes a concept less independent and harder to reuse.

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
