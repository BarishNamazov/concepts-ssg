---
title: Issue Review
layout: Blog
---

## Issue Review

Issues are grouped by the layer they affect, making it easier to understand which part of the system each problem belongs to.

<div class="callout callout-warn">
These pages are not a changelog. They are a repair map: what can fail, why it matters, and what kind of fix would make the design sturdier.
</div>

## Categories

<div class="grid-2">

<a href="/issues/concept-design" class="card" style="text-decoration: none; color: inherit; border-left: 5px solid #1f5fbf;">
<h3>Concept Design</h3>
<p class="meta">1 issue</p>
<p>Concepts carrying app concerns, conflation of identity spaces, and global mutable state.</p>
</a>

<a href="/issues/sync-layer" class="card" style="text-decoration: none; color: inherit; border-left: 5px solid #ea580c;">
<h3>Sync Layer</h3>
<p class="meta">5 issues</p>
<p>Stage gating, failure propagation, dev overlaps, registration-order sensitivity, and missing rebuild triggers.</p>
</a>

<a href="/issues/engine-core" class="card" style="text-decoration: none; color: inherit; border-left: 5px solid #dc2626;">
<h3>Engine Core</h3>
<p class="meta">5 issues</p>
<p>Evidence matching, frame query determinism, failure isolation, and registration semantics.</p>
</a>

<a href="/issues/filesystem-io" class="card" style="text-decoration: none; color: inherit; border-left: 5px solid #ca8a04;">
<h3>Filesystem &amp; I/O</h3>
<p class="meta">2 issues</p>
<p>Binary asset corruption and content-type edge cases.</p>
</a>

<a href="/issues/parsing-validation" class="card" style="text-decoration: none; color: inherit; border-left: 5px solid #2563eb;">
<h3>Parsing &amp; Validation</h3>
<p class="meta">4 issues</p>
<p>Regex-based template parsing, CLI argument validation, frontmatter detection, and mode validation.</p>
</a>

</div>

## How To Read These Pages

Each issue page keeps the same shape:

- **Problem:** the brittle behavior or design violation.
- **Why it matters:** the runtime or conceptual risk.
- **Repair direction:** the kind of change that would make the system safer.

## Themes

The findings cluster around four themes.

| Theme | What it means |
|---|---|
| Concept independence | Concepts should not carry app-specific template or runtime semantics. |
| Sync gating | Success actions must not run just because they appear later in a `then` list. |
| Engine determinism | Matching, consumption, ordering, and failure handling need sharper invariants. |
| Filesystem boundaries | Paths must be canonicalized before serving, writing, or deleting. |

Start with [Concept Design](/issues/concept-design) for independence problems, or [Engine Core](/issues/engine-core) for the deepest framework-level bugs.
