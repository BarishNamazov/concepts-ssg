---
title: SSG Architecture
layout: Blog
date: 2026-06-07
collections: docs
description: "A concept-by-concept map of the static-site generator in this repository."
---

## SSG Architecture

The example app is a static-site generator decomposed into independent concepts and composed by syncs. This page is the reference map; the blog is the guided tour.

## Concept Map

| Concept | Owns | Does not own |
|---|---|---|
| `CommandLine` | CLI invocation status, notices, terminal result | Build behavior |
| `Commanding` | Generic command issue/succeed/fail lifecycle | CLI parsing or build work |
| `Building` | Build status | File lists or output safety |
| `Filing` | File entries, text read/write, output cleanup | Markdown, routes, layouts |
| `Frontmattering` | Metadata/body split for documents | Filesystem paths or rendering |
| `Formatting` | Source-to-HTML rendering | Layouts or routes |
| `Routing` | Entry-to-route derivation and collision checks | File reads or template output |
| `Layouting` | Layout definitions and composed HTML | Filesystem output or command status |
| `Collecting` | Entry membership in named collections | Template syntax ideally |
| `Publishing` | A publication/artifact model | Currently not the main app write path |
| `Serving` | Static HTTP serving and reload signals | Build orchestration |
| `Watching` | Watcher/change state | Filesystem driver details ideally |

## Sync Groups

The application behavior is declared in `src/syncs`.

| Sync file | Role |
|---|---|
| `cli.sync.ts` | Parse CLI invocations, issue commands, and link command outcomes back to invocations. |
| `build.sync.ts` | Start build-scoped work: reset state, configure routing, scan inputs, complete, clean, succeed. |
| `discovery.sync.ts` | Fan out scan results into per-entry reads. |
| `content.sync.ts` | Parse frontmatter, render content, derive routes, collect metadata, and report parse notices. |
| `templates.sync.ts` | Define layouts, apply layouts, and regenerate collection index pages. |
| `publishing.sync.ts` | Convert composed pages into file writes. |
| `assets.sync.ts` | Copy public entries through the file path. This is currently text-oriented and needs binary-safe handling. |
| `errors.sync.ts` | Fail commands on scan errors. |
| `pipeline-errors.sync.ts` | Attempt to fail commands on later pipeline errors. The review found command-context gaps here. |
| `dev.sync.ts` | Start dev server/watchers, trigger rebuilds, and reload browsers. |
| `reporting.sync.ts` | Aggregate and print build stats. |

## Main Build Flow

```txt
CommandLine.invoke
  -> Commanding.issue("build")
  -> Building.start
  -> Filing.scan(layouts)
  -> Filing.scan(content)
  -> Filing.scan(public)
  -> per-entry content and layout cascades
  -> Building.complete
  -> Filing.cleanOutput
  -> Commanding.succeed
```

This is the current shape, not a guarantee that the implementation is fully safe. The review found that success and cleanup need stronger stage gates.

## Per-Entry Flow

```txt
Filing.read
  -> Frontmattering.parse
      -> Formatting.render
      -> Routing.derive
      -> Collecting.collect
  -> Layouting.apply
  -> Filing.write
```

The important design boundary is that each concept owns a relation over the entry identity. Syncs join those relations.

## Runtime Flow

Dev mode adds runtime behavior around the build:

```txt
Commanding.issue("dev")
  -> Serving.start
  -> Watching.start
  -> Commanding.issue("build")
  -> on change: Commanding.issue("build")
  -> on rebuild success: Serving.reload
```

The review found that dev startup and rebuilds need serialization and better failure cleanup.

## Known Design Debt

The major architecture debts are published by the layer they affect:

- [Concept Design Issues](/issues/concept-design): command leakage, global state, identity conflation
- [Sync Layer Issues](/issues/sync-layer): stage gating, failure propagation, dev races
- [Engine Core Issues](/issues/engine-core): evidence matching, frame determinism, failure isolation
- [Filesystem & I/O Issues](/issues/filesystem-io): path escape, binary corruption, content-type bugs
- [Parsing & Validation Issues](/issues/parsing-validation): regex templates, CLI validation, frontmatter detection

## Related Reading

- [This Repo in One Pass](/blog/concept-design-intro)
- [The Build Pipeline](/blog/the-pipeline)
- [Friction Log](/blog/friction-log)
