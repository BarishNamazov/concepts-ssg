---
title: Tutorials
layout: Blog
type: index
---

## Tutorials

Step-by-step guides to building applications with Concept Design.

<ul>
{{#each tutorials}}
  <li style="margin: 1rem 0;">
    <a href="{{route}}" style="font-size: 1.1rem; font-weight: 600;">{{title}}</a>
    <br><span style="color: var(--muted); font-size: 0.85rem;">{{date}}</span>
    <p style="margin: 0.3rem 0; color: var(--muted); font-size: 0.92rem;">{{description}}</p>
  </li>
{{/each}}
</ul>
