---
title: My First Post
layout: Blog
date: 2026-06-01
collections: posts
---
## Welcome to My First Post

This is a blog post using the **Blog** layout, which includes a Header, Footer, and content area.

The Blog layout is composed from three sub-layouts:

- `<Header />` — site navigation and title
- The main content (this text, rendered from markdown)
- `<Footer />` — copyright and metadata

### Code Example

```typescript
// This SSG is built with concept-design
const { Filing, Frontmattering, Formatting, Routing, Layouting } = concepts;

// File → HTML → route → layout → output
// All wired together by syncs
```

Layout composition is resolved recursively at build time by the **Layouting** concept.
