---
title: My Blog
layout: Blog
type: index
---
## Latest Posts

<ul>
{{#each posts}}
  <li><a href="{{route}}">{{title}}</a> — {{date}}</li>
{{/each}}
</ul>
