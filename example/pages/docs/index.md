---
title: Documentation
layout: Blog
---

## Documentation

This documentation explains the concept-design model, the static-site generator built with it, and the issue review that identifies where the current implementation needs hardening.

### Read The Project

<div class="grid-2">

<a href="/docs/concepts" class="card" style="text-decoration: none; color: inherit;">
<h3>Concepts</h3>
<p class="meta">The independent building blocks</p>
<p>What a concept is, how state/actions/queries are specified, and how independence is evaluated.</p>
</a>

<a href="/docs/syncs" class="card" style="text-decoration: none; color: inherit;">
<h3>Synchronizations</h3>
<p class="meta">Declarative composition</p>
<p>The <code>when</code>, <code>where</code>, <code>then</code> pattern, frames, queries, matching, and flow isolation.</p>
</a>

<a href="/docs/app-specification" class="card" style="text-decoration: none; color: inherit;">
<h3>App Specification</h3>
<p class="meta">Full concept & sync DSL</p>
<p>The complete specification of every concept and sync with the concept-design DSL.</p>
</a>

<a href="/issues" class="card" style="text-decoration: none; color: inherit;">
<h3>Issue Review</h3>
<p class="meta">The hardening map</p>
<p>Findings from the code review grouped by the layer they affect: concept design, syncs, engine, runtime I/O, and parsing.</p>
</a>

</div>

### Field Guide

<div class="grid-2">

<a href="/blog/concept-design-intro" class="card" style="text-decoration: none; color: inherit;">
<h3>This Repo In One Pass</h3>
<p>A source tour across concepts, syncs, engine, runtime, and example content.</p>
</a>

<a href="/blog/the-pipeline" class="card" style="text-decoration: none; color: inherit;">
<h3>The Build Pipeline</h3>
<p>How one CLI action expands into scans, cascades, index regeneration, cleanup, and reporting.</p>
</a>

<a href="/blog/from-markdown-to-html" class="card" style="text-decoration: none; color: inherit;">
<h3>From Markdown To Published Page</h3>
<p>A single content file moving through the concepts that publish it.</p>
</a>

<a href="/blog/friction-log" class="card" style="text-decoration: none; color: inherit;">
<h3>Friction Log</h3>
<p>The narrative version of the issue review and the model's current sharp edges.</p>
</a>

</div>

### Reference

| Topic | Description |
|---|---|
| [Concepts](/docs/concepts) | Specification format, state design, actions, queries |
| [Syncs](/docs/syncs) | Sync DSL, pattern matching, frames, flow isolation |
| [App Specification](/docs/app-specification) | Full concept and sync specification |
| [Issue Review](/issues) | Review findings grouped by severity |
| [How Syncs Wire This Repo](/blog/syncs-in-this-repo) | Project-specific sync walkthrough |
