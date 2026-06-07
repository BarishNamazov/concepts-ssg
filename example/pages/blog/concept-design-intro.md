---
title: This Repo in One Pass
layout: Blog
date: 2026-06-07
collections: posts
description: "A source tour of the concept-design framework repo: concepts, syncs, engine, runtime, and the example site."
---

## This Repo in One Pass

This project builds a static site generator out of independent behavioral units called **concepts**, then wires them together with declarative **synchronizations**. The example site you are reading is the output of that generator documenting itself.

## The Five Layers

| Layer | Path | Role |
|---|---|---|
| Concepts | `src/concepts/` | Independent state machines. Each owns its data, actions, and queries. No concept imports another. |
| Syncs | `src/syncs/` | Declarative `when`/`where`/`then` rules that compose concepts into an application. |
| Engine | `src/engine/` | The action journal, frame matcher, and sync runner that executes the sync rules. |
| Runtime | `src/runtime/` | Process adapters: CLI argument parsing and filesystem change watching. |
| Example | `example/` | Markdown pages, HTML layouts, and public assets that exercise the generator. |

## The Eleven Concepts

| Concept | What it owns |
|---|---|
| `CommandLine` | CLI invocation lifecycle — status, notices, terminal result |
| `Commanding` | Generic command issue/succeed/fail without knowing what the command does |
| `Building` | Build lifecycle status — whether a build is running or done |
| `Filing` | File entries: scan, read, write, output cleanup |
| `Frontmattering` | Split a document into YAML metadata and markdown body |
| `Formatting` | Convert markdown body to HTML |
| `Routing` | Turn a file path into a clean URL, detect collisions |
| `Layouting` | Define HTML layouts, apply them to rendered content |
| `Collecting` | Track entry membership in named collections (e.g. "posts", "docs") |
| `Serving` | Static HTTP server with SSE-based reload |
| `Watching` | Compare snapshots to detect added/changed/removed files |

## How It Runs

One entry point. One root action. Everything else emerges from syncs.

```
bun run example:build
  → CommandLine.invoke({ argv })
  → Commanding.issue("build")
  → Building.start
  → Filing.scan(layouts) → Filing.scan(content) → Filing.scan(public)
  → per-file cascade (parse → render → route → collect → layout → write)
  → Building.complete
  → index page regeneration
  → Filing.cleanOutput
  → Commanding.succeed
```

No function calls any of those steps. Each step fires because a sync matched the previous step's journal record.

## The Design Constraint

Concepts cannot import each other. `Formatting` turns markdown into HTML but does not know what a route is. `Routing` derives URLs but does not know about frontmatter. `Layouting` wraps content in HTML but does not know about files.

The connections — "after parsing, render the content" or "once rendering and routing are both done, apply a layout" — are expressed in sync files, not inside the concepts.

## What To Read Next

Start with [How the SSG Is Built](/blog/building-ssg) for the decomposition decisions, then [How Syncs Wire This Repo](/blog/syncs-in-this-repo) for the composition layer. The [Friction Log](/blog/friction-log) catalogues where the design still bends.
