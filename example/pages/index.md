---
title: Concept Design Framework
subtitle: A static site generator used as a living demonstration of concept design, sync composition, and the brittle edges found in review.
layout: Home
---

## What This Repo Is

This repository is not just a static site generator. It is a worked example of **concept design**: independent units of behavior are implemented as concepts, then composed by declarative synchronizations.

The example site documents the project from the inside. It explains what the concepts do, how the sync engine moves work through the pipeline, and where the current implementation is still fragile.

<div class="grid-3" style="margin-top: 1.5rem;">

<div class="card">
<h3>Concepts Own Behavior</h3>
<p>Each concept is a small state machine with actions and queries. A concept should not import another concept or assume what application it lives in.</p>
</div>

<div class="card">
<h3>Syncs Compose Work</h3>
<p>The build is declared as <code>when</code>, <code>where</code>, and <code>then</code> rules over journaled actions instead of imperative orchestration code.</p>
</div>

<div class="card">
<h3>Issues Are First-Class</h3>
<p>The review log is published as part of the example site, grouped by the layer each problem belongs to so the architecture can be improved openly.</p>
</div>

</div>

## The Demonstration App

The generator turns markdown, HTML layouts, and public assets into a static site. The interesting part is how it is decomposed.

<div class="grid-2" style="margin-top: 1rem;">

<div class="card">
<h3>Build Boundary</h3>
<p class="meta">CommandLine, Commanding, Building</p>
<p>The process starts with one CLI action. Commands and builds track lifecycle state while syncs decide what happens next.</p>
</div>

<div class="card">
<h3>Content Pipeline</h3>
<p class="meta">Filing, Frontmattering, Formatting, Routing</p>
<p>Files are discovered, read, split into metadata and body, rendered to HTML, and assigned clean routes.</p>
</div>

<div class="card">
<h3>Presentation Layer</h3>
<p class="meta">Layouting, Collecting, Publishing</p>
<p>Layouts wrap content, collections feed index pages, and final output is written to disk.</p>
</div>

<div class="card">
<h3>Developer Loop</h3>
<p class="meta">Serving, Watching</p>
<p>Dev mode serves the output directory, watches source files, rebuilds on change, and reloads browsers.</p>
</div>

</div>

## Start Reading

<div class="grid-2" style="margin-top: 1rem;">

<a href="/blog" class="card" style="text-decoration: none; color: inherit;">
<h3>Project Field Guide</h3>
<p class="meta">Blog posts about this repository</p>
<p>Read the repo as a running system: concepts, syncs, file flow, dev mode, and tradeoffs.</p>
</a>

<a href="/issues" class="card" style="text-decoration: none; color: inherit;">
<h3>Issue Review</h3>
<p class="meta">Grouped by layer</p>
<p>Browse the review findings by category: concept design, sync layer, engine, filesystem, and parsing.</p>
</a>

<a href="/docs/ssg-architecture" class="card" style="text-decoration: none; color: inherit;">
<h3>Architecture Notes</h3>
<p class="meta">Concept-by-concept reference</p>
<p>See how the generator is divided into reusable units and what each one owns.</p>
</a>

<a href="/blog/friction-log" class="card" style="text-decoration: none; color: inherit;">
<h3>Friction Log</h3>
<p class="meta">Where the model bends</p>
<p>Understand the places where declarative sync composition becomes awkward or brittle.</p>
</a>

</div>

<div class="callout" style="margin-top: 1.5rem;">
<strong>Build this site:</strong>
<pre style="margin: 0.6rem 0 0 0; padding: 0.6rem 1rem;"><code>bun run example:build</code></pre>
</div>
