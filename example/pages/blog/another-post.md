---
title: Another Post
layout: Blog
date: 2026-05-15
collections: posts
---
## The Power of Syncs

Syncs are declarative rules that wire concepts together:

```sync
when Filing.scan discovers entries
then Filing.read each entry

when Filing.read returns content
then Frontmattering.parse the frontmatter

when Frontmattering.parse completes
then Formatting.render markdown to HTML
then Routing.derive the URL route

when both render and route complete
then Layouting.apply the page template

when Layouting.apply produces output
then Filing.write the file to disk
```

Each concept remains **completely independent** — no imports, no coupling. The syncs are the only place where concepts meet.
