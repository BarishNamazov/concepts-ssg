---
title: Projects
layout: Blog
type: index
---

## Projects

Real-world applications built with Concept Design.

<ul>
{{#each projects}}
  <li style="margin: 1rem 0;">
    <a href="{{route}}" style="font-size: 1.1rem; font-weight: 600;">{{title}}</a>
    <br><span class="badge badge-outline" style="font-size: 0.7rem;">{{status}}</span>
    <p style="margin: 0.3rem 0; color: var(--muted); font-size: 0.92rem;">{{description}}</p>
  </li>
{{/each}}
</ul>
