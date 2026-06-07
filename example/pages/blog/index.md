---
title: Project Field Guide
layout: Blog
type: index
---

## Project Field Guide

This blog explains the repository itself: why it is shaped around independent concepts, how the static-site generator works, and which parts of the design still need hardening.

<div class="callout">
Read this as a guided source tour. The code lives in <code>src/concepts</code>, <code>src/syncs</code>, <code>src/engine</code>, and <code>example/pages</code>.
</div>

<ul>
{{#each posts sort=date}}
  <li style="margin: 1rem 0;">
    <a href="{{route}}" style="font-size: 1.1rem; font-weight: 600;">{{title}}</a>
    <br><span style="color: var(--muted); font-size: 0.85rem;">{{date}}</span>
    <p style="margin: 0.3rem 0; color: var(--muted); font-size: 0.92rem;">{{description}}</p>
  </li>
{{/each}}
</ul>

## Related

<div class="grid-2">

<a href="/issues" class="card" style="text-decoration: none; color: inherit;">
<h3>Issue Review</h3>
<p>Findings from the code review grouped by the layer they affect.</p>
</a>

<a href="/docs/ssg-architecture" class="card" style="text-decoration: none; color: inherit;">
<h3>Architecture Reference</h3>
<p>Every concept and the sync groups that compose them.</p>
</a>

</div>
