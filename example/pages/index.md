---
title: Concept Design
subtitle: Build software from independent, reusable concepts composed by declarative synchronizations. No framework lock-in, no implicit coupling — just clean, composable design.
layout: Home
---

## How It Works

Concept Design separates your application into **concepts** — self-contained behavioral units that know nothing about each other. A concept owns its state, actions, and queries. Concepts are wired together by **synchronizations** (syncs) — declarative `when` / `where` / `then` rules.

<div class="grid-3" style="margin-top: 1.5rem;">

<div class="card">
<h3>&#9670; Concepts</h3>
<p class="meta">Independent behavioral units</p>
<p>A concept defines its own state, actions, and queries. It never imports another concept. Think of it as a micro-service in your process.</p>
</div>

<div class="card">
<h3>&#8644; Syncs</h3>
<p class="meta">Declarative composition</p>
<p>Syncs wire concepts together: <em>when</em> an action fires, <em>where</em> conditions hold, <em>then</em> another action occurs. Pure causal rules, no imperative glue.</p>
</div>

<div class="card">
<h3>&#9889; Engine</h3>
<p class="meta">Reactive journal</p>
<p>The engine maintains an append-only action journal. Syncs match against it in real time, binding logic variables and fanning out over query results.</p>
</div>

</div>

## This Site Generator

This very site is built with Concept Design. Seven concepts power the entire static-site pipeline:

| Concept | Responsibility |
|---|---|
| `Commanding` | CLI command lifecycle |
| `Building` | Tracks build progress and completion |
| `Filing` | Filesystem discovery, reading, and writing |
| `Frontmattering` | YAML metadata extraction from documents |
| `Formatting` | Markdown-to-HTML conversion |
| `Routing` | File path to URL route derivation |
| `Layouting` | Template composition and rendering |
| `Collecting` | Collection membership for index pages |
| `Publishing` | Output snapshot and stale-file cleanup |

Eleven sync rules compose them into a complete build pipeline — from `Commanding.issue("build")` to files on disk.

<div class="callout callout-tip">
<strong>Try it yourself:</strong> Clone the repo, edit <code>example/pages/</code>, and run <code>bun run src/main.ts build --source example/pages --output example/dist --layouts example/layouts</code>.
</div>

## Explore

<div class="grid-2" style="margin-top: 1.5rem;">

<a href="/docs" class="card" style="text-decoration: none; color: inherit;">
<h3>Documentation</h3>
<p class="meta">Learn the core concepts and sync patterns</p>
</a>

<a href="/tutorials" class="card" style="text-decoration: none; color: inherit;">
<h3>Tutorials</h3>
<p class="meta">Step-by-step guides to building with concepts</p>
</a>

<a href="/blog" class="card" style="text-decoration: none; color: inherit;">
<h3>Blog</h3>
<p class="meta">Deep dives into concept-design principles</p>
</a>

<a href="/projects" class="card" style="text-decoration: none; color: inherit;">
<h3>Projects</h3>
<p class="meta">Real-world examples built with concepts</p>
</a>

</div>
