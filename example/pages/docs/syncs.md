---
title: Understanding Syncs
layout: Blog
---

## Synchronizations

Synchronizations (syncs) are **declarative rules** that wire concepts together. A sync says: *when* this action fires, *where* these conditions hold, *then* fire that other action.

### The `when` / `where` / `then` Pattern

```typescript
export const ScanTriggersRead: Sync = ({ entry, entries }) => ({
  // Match when Filing.scan completes successfully
  when: actions([Filing.scan, {}, { entries }]),

  // Fan out: one frame per discovered entry
  where: (frames) =>
    frames.flatMap((frame) => {
      const entryIds = frame[entries] as string[];
      return entryIds.map((id) => ({ ...frame, [entry]: id }));
    }),

  // Fire Filing.read for each entry
  then: actions([Filing.read, { entry }]),
});
```

**`when`** — An ordered list of action patterns. Each clause matches a journal record by concept + action identity, then unifies input/output patterns. Logic variables (symbols) bind to matched values. All clauses must match within the same causal flow.

**`where`** — An optional pure transform. Takes the frames produced by `when` and returns new frames. Can query concepts, filter, map, fan-out, or aggregate. Frames that produce zero query rows are dropped (inner-join semantics).

**`then`** — Actions to invoke, one per surviving frame. Input bindings are resolved from the frame's logic variables.

### Flow Isolation

Every action invocation carries a **flow token**. Actions produced by a sync's `then` inherit the triggering action's flow. Matching is restricted to a single flow, so independent invocations never cross-match.

### Double-Fire Prevention

Each journal record tracks which syncs have already consumed it. Once a record matches a sync's `when`, it's marked as synced and cannot match that same sync again.

### Query Helpers

Frames provide a `.query()` method for fan-out operations:

```typescript
where: async (frames) => {
  // For each frame, query Filing._getEntry, binding results
  frames = await frames.query(
    Filing._getEntry,
    { entry },           // input mapping (symbols resolved from frame)
    { path: filePath },  // output mapping (result columns bound to symbols)
  );
  return frames.filter(f => /* ... */);
}
```

### Error Syncs

Error handling is also declarative — match on `{ error }` output patterns:

```typescript
const ScanErrorFailsBuild: Sync = ({ command, error }) => ({
  when: actions([Filing.scan, { command }, { error }]),
  then: actions([Commanding.fail, { command, error }]),
});
```

Success syncs use explicit output fields (`{ entries }`), while error syncs match `{ error }`. They never conflict.

### The Build Pipeline

This SSG's entire build pipeline is 11 syncs:

1. **BuildCommand** — command → clears + configure + scans + complete
2. **ScanTriggersRead** — scan → read per entry
3. **LayoutReadTriggersDefine** — layout read → define template
4. **ReadTriggersParse** — content read → parse frontmatter
5. **ParseTriggersRender** — parse → render markdown
6. **ParseTriggersRoute** — parse → derive URL
7. **ParseTriggersCollect** — parse → collect metadata
8. **RouteTriggersUpdateIndex** — route → update collection
9. **RenderAndRouteTriggersApply** — render + route → layout
10. **ApplyTriggersWrite** — layout → write to disk
11. **FinalizeTriggersIndexRegen** — complete → regenerate list pages
