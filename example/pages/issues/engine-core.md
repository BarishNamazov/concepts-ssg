---
title: Engine Core Issues
layout: Blog
---

## Engine Core Issues

These issues are in the sync engine itself — matching, evidence consumption, frame determinism, and failure isolation. Fixing these improves every application built on the model.

### ISS-003: `when` matching can reuse the same journal action twice

**Problem:** `matchWhen` joins every `when` clause against all flow actions but never prevents one `ActionRecord` from satisfying multiple clauses in one match. A sync like `when A(), A()` can fire after a single `A` action.

**Why it matters:** False-positive sync firings. Self-triggering loops. Tests that pass because same-record matches happen to be filtered later.

**Repair direction:** Track matched action IDs per candidate frame. Reject reuse within the same `when` match unless the DSL explicitly permits it.

### ISS-004: Evidence consumed too coarsely and before `then` succeeds

**Problem:** The `synced` map is keyed by sync name only. Once a record participates in one firing, it cannot participate in later firings of the same sync. Evidence is marked consumed before the `then` action runs.

**Why it matters:** Valid fan-out patterns are silently skipped. Failed `then` actions leave consumed evidence that cannot be retried.

**Repair direction:** Store match signatures (`sync name + ordered action IDs`). Only mark consumed after all produced actions are journaled or a structured failure is recorded.

### ISS-021: Frame query semantics can be nondeterministic or fail late

**Problem:** Async queries append results as promises resolve, so frame order depends on timing. Missing query output keys still produce frames with unbound variables. `undefined` is treated as missing. `collectAs` groups by stringified keys.

**Why it matters:** Order-sensitive output can be flaky. Invalid query rows fail far from their source. Symbol and value collisions are possible.

**Repair direction:** Preserve source-frame order. Reject incomplete rows early. Use property-presence checks. Group by symbol identity or stable serializer.

### ISS-022: Engine failure isolation is brittle

**Problem:** Re-registering a sync name leaves old syncs indexed by action. Errors in one sync can abort later syncs for the same action. Thrown actions leave incomplete journal records. Journal records expose mutable state.

**Why it matters:** Hot registration or tests can double-fire stale syncs. One failing sync can skip unrelated syncs. Incomplete journal records can confuse downstream matchers.

**Repair direction:** Reject or de-index duplicate sync names. Isolate per-sync errors. Record structured action failures. Clone or freeze journal records and query results.

### ISS-025: Test isolation and regression coverage leave flaky areas unprotected

**Problem:** Engine tests cover happy paths but not same-record reuse, fan-out after one antecedent, failure consumption, async query ordering, or per-sync failure isolation. Some concept tests share temp directories or servers across test cases.

**Why it matters:** The flakiest engine and filesystem behaviors can regress without tests failing. Test runs can leak temp directories or ports.

**Repair direction:** Add focused regression tests for each engine invariant. Per-test setup and cleanup for temp files and servers with assigned ports.

## Related

- [Concept Design Issues](/issues/concept-design) — independence and identity problems
- [Sync Layer Issues](/issues/sync-layer) — pipeline gating and error propagation
- [Back to Issue Review](/issues)
