---
title: How the SSG Is Built
layout: Blog
date: 2026-06-06
collections: posts
description: "How the example static site generator is decomposed into independent concepts and recomposed with syncs."
---

## How the SSG Is Built

The example app is a static site generator that reads markdown pages, combines them with HTML layouts, and writes a complete site to disk. The architecture's claim is that the whole pipeline can be decomposed into independent concepts and composed declaratively.

## The Decomposition

Instead of one `SiteBuilder` class, the work is split across 12 concepts. Each owns a narrow slice of behavior.

### Build Lifecycle

**`CommandLine`** owns the process entry point. `invoke({ argv })` records the raw CLI arguments and waits for a terminal result. It stores the invocation status and carries notices (stdout messages). The concept does not parse arguments or know what "build" means.

**`Commanding`** owns a generic command lifecycle: `issue`, `succeed`, `fail`. The command ID is the correlation token. When a command succeeds or fails, syncs propagate that back to the waiting `CommandLine` invocation.

**`Building`** owns build status. `start` and `complete` frame a build run. Syncs use `Building.complete` as a barrier — index pages wait for it, cleanup runs after it.

**`Coalescing`** owns rebuild scheduling for dev mode. It lets one build run for a dev session while collapsing rapid follow-up changes into one queued rebuild. It does not know what a build is; it only tracks active and pending requests for a context.

### File System

**`Filing`** owns file entries. Each entry has a source tag ("content", "layout", "public"), a file path, and optionally content fields. Actions: `scan` discovers files by glob, `read` loads text content, `write` creates text output files, `copy` streams public assets as bytes, `clear` resets state, and `cleanOutput` removes stale files. Text I/O is scoped to content and layouts; public assets use the binary-safe copy path.

### Content Processing

**`Frontmattering`** splits a raw string into YAML frontmatter fields and a markdown body. It does not know about files, routes, or layouts.

**`Formatting`** converts markdown body text to HTML using the `marked` library. HTML content passes through unchanged. The result is stored as an opaque string keyed by entry ID.

**`Routing`** derives a clean URL from a file path. `pages/blog/post.md` becomes `/blog/post`; `pages/index.md` becomes `/`. It detects route collisions and assigns each route to one entry. Configuration (prefix, index name) is set per-build.

### Presentation

**`Layouting`** manages two things: layout definitions (load once per layout file) and layout application (resolve the layout for an entry, substitute variables such as the title and body content, and produce final HTML). Layouts are small in this example — they support named component slots, scalar variables, and collection loops.

**`Collecting`** records which entries belong to which named collections. A page's frontmatter `collections: posts` becomes a membership record. This powers index pages: "list all entries in the posts collection."

### Runtime

**`Serving`** starts an HTTP server on a given port. It serves static files from a root directory and maintains SSE connections for live reload. Directory requests like `/blog` resolve to `index.html`, and live reload is injected based on the resolved file path.

**`Watching`** compares directory snapshots over time. Each `poll` action reports added, changed, and removed file paths. The concept is typed-generic over subject identity, though the current implementation leaks filesystem details.

## What Each Concept Must Not Do

The constraint that makes the architecture work: no concept imports another. `Formatting.render` receives a string and returns a string. It does not know that string came from `Filing.read` or that the result will feed into `Layouting.apply`.

This means every concept is testable in isolation. You can instantiate `RoutingConcept`, call `derive`, and assert the route — no filesystem, no markdown parser, no HTML layouts needed.

## Where the Implementation Falls Short

The code review found that some concepts still carry application-specific context. `Watching` leaks filesystem and runtime details into a nominally generic concept, and other runtime-facing concepts blur framework and environment boundaries. These are catalogued in the [issue review](/issues).

## Next

Read [How Syncs Wire This Repo](/blog/syncs-in-this-repo) to see how these 12 independent concepts become one application.
