---
title: How Syncs Wire This Repo
layout: Blog
date: 2026-06-05
collections: posts
description: "A walkthrough of when/where/then syncs, the seven sync files, flow isolation, and where the current sync layer is brittle."
---

## How Syncs Wire This Repo

Concepts are isolated. Syncs are where the application becomes an application. Each sync file under `src/syncs/` declares a set of reactions over journaled actions.

## The Shape of a Sync

Every sync has three clauses:

```ts
const ReadTriggersParse: Sync = ({ entry, content }) => ({
  when: actions([Filing.read, {}, { entry, content }]),
  where: async (frames) => frames,
  then: actions([Frontmattering.parse, { entry, raw: content }]),
});
```

| Clause | Role |
|---|---|
| `when` | Match actions recorded in the current flow. Patterns bind logic variables to action inputs and outputs. |
| `where` | Transform, filter, or enrich frames. Can fan out an array, query concept state, or drop frames that do not meet a condition. |
| `then` | Fire follow-up actions — one invocation per surviving frame. |

The symbols `entry` and `content` are logic variables. When `when` matches a `Filing.read` action, `entry` is bound to the action's output entry and `content` to its output content. The `then` clause uses those bindings to construct the `Frontmattering.parse` input.

## The Sync Files

Seven sync files wire the entire build pipeline:

| File | What it composes |
|---|---|
| `cli.sync.ts` | CLI invocation → command issue → command outcome → terminal result |
| `build.sync.ts` | Build command → reset state → configure routing → scan all inputs → complete → clean → succeed |
| `discovery.sync.ts` | Scan result arrays → fan out → one read action per entry |
| `content.sync.ts` | Read → parse frontmatter → render markdown → derive route → collect metadata |
| `templates.sync.ts` | Layout files → layout definitions; render + route → layout application; build complete → index regeneration |
| `publishing.sync.ts` | Layout output → file write |
| `dev.sync.ts` | Dev command → start server → start watcher → initial build → watch events → rebuild → reload |

There are also error syncs (`errors.sync.ts`, `pipeline-errors.sync.ts`) that match action outputs containing `{ error }` and propagate failures to the command lifecycle.

## How the Build Emerges

There is no `buildSite()` function. The build emerges because syncs match journaled actions from the same causal flow.

```
CommandLine.invoke         // user runs the CLI
  → Commanding.issue       // cli.sync.ts
  → Building.start         // build.sync.ts
  → Filing.clear           // build.sync.ts
  → Filing.scan(layouts)   // build.sync.ts → generates entries
  → Filing.read            // discovery.sync.ts fans out scan results
  → Layouting.define       // templates.sync.ts matches layout reads
  → Filing.scan(content)   // build.sync.ts
  → Filing.read            // discovery.sync.ts
  → Frontmattering.parse   // content.sync.ts matches content reads
  → Formatting.render      // content.sync.ts matches parses
  → Routing.derive         // content.sync.ts matches parses
  → Collecting.collect     // content.sync.ts matches parses
  → Filing.scan(public)    // build.sync.ts
  → Filing.read            // discovery.sync.ts
  → Building.complete      // build.sync.ts — barrier: index regen waits
  → Layouting.apply        // templates.sync.ts joins render + route
  → Filing.write           // publishing.sync.ts matches layout applications
  → Filing.cleanOutput     // build.sync.ts
  → Commanding.succeed     // build.sync.ts
  → CommandLine.succeed    // cli.sync.ts
```

## Flow Isolation

Every root action starts a causal flow. Actions fired by sync `then` clauses inherit the flow of the action they reacted to. Sync matching is scoped to a single flow.

This prevents one build's `Formatting.render` from accidentally joining another build's `Routing.derive`. The journal is the persistent log, but syncs only see the current flow's entries.

## Queries in `where`

A `when` clause only sees action inputs and outputs. To inspect stored concept state, the `where` clause calls concept queries:

```ts
where: async (frames) => {
  frames = await frames.query(Formatting._getHtml, { entry }, { html });
  frames = await frames.query(Frontmattering._getAllFields, { entry }, { fields });
  return frames;
}
```

Queries return arrays. Zero rows drop the frame (inner-join semantics). Multiple rows fan the frame out — one frame per result row.

## Join: Waiting for Render and Route

Layout application needs both rendered HTML and a route for the same entry. Rendering and routing happen independently after parsing. The sync that triggers layout uses a multi-clause `when`:

```ts
when: actions(
  [Formatting.render, {}, { entry }],
  [Routing.derive, { entry }, {}],
)
```

Both actions must exist in the flow for the same `entry`. If only one has fired, the sync does not match yet.

## Where the Sync Layer Is Brittle

The review found several problems in the current syncs:

 - **No error gating.** The build sync fires `Building.complete`, `Filing.cleanOutput`, and `Commanding.succeed` in the same `then` list as the scans. If a scan returns `{ error }`, later actions still run. A failed build can report success.

These are catalogued in detail in the [Sync Layer issues](/issues/sync-layer).

## Next

Read [The Build Pipeline](/blog/the-pipeline) for the full execution sequence, then [From Markdown to Published Page](/blog/from-markdown-to-html) to follow a single file through every concept.
