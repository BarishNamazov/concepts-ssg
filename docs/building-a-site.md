# Building a Site

This guide walks through creating a static site with the SSG. The
[example site](../example/) is the best reference — it is built by the
same tool and documents the project itself.

## Directory Structure

```
mysite/
  pages/        *.md, *.html        content pages with optional frontmatter
  layouts/      *.html              HTML layout templates
  public/       *                   static assets copied as-is
```

All three directories are optional (`layouts/` and `public/` can be
omitted), but `pages/` is where your content lives.

## Content Pages

Each page is a markdown (`.md`) or HTML (`.html`) file. Markdown is
rendered to HTML; HTML files pass through unchanged.

Every page can have **YAML frontmatter** at the top:

```markdown
---
title: My Page
layout: default
date: 2026-06-08
collections: posts
description: "A short description."
---
Content goes here. Markdown works.
```

### Frontmatter Fields

| Field | Purpose |
|---|---|
| `title` | Page title, available as `{{title}}` in layouts |
| `layout` | Layout template to use (default: `"default"`) |
| `collections` | Comma-separated collection names for `{{#each}}` listing |
| `date` | Publication date (used for sorting collections) |
| Any other field | Available as a variable in layouts |

### Routing

File paths become clean URLs:

- `index.md` → `/`
- `blog/index.md` → `/blog`
- `blog/my-post.md` → `/blog/my-post`

The output writes `/blog/my-post/index.html` so browsers see `/blog/my-post`.

## Layouts

Layouts are HTML files in `layouts/`. They use four mechanisms:

### 1. Component Tags

Reference other layouts by filename (without `.html`):

```html
<Header />
```

Wrapper components inject their inner content into a `<slot>`:

```html
<BaseLayout>
  <Header />
  <slot/>
  <Footer />
</BaseLayout>
```

Components can nest — `BaseLayout` might wrap everything inside a shared
DOCTYPE, `<head>`, and `<body>`.

### 2. Variable Substitution

Use `{{fieldName}}` to insert frontmatter values:

```html
<title>{{title}} — My Site</title>
```

The special variable `{{content}}` holds the rendered page body.

### 3. Slots

The page body is injected where `<slot/>` appears. A fallback can be
provided:

```html
<slot>This shows when no content is provided.</slot>
```

### 4. Collection Loops

Iterate over a collection of pages:

```html
<ul>
{{#each posts sort=date}}
  <li>
    <a href="{{route}}">{{title}}</a>
    <span>{{date}}</span>
  </li>
{{/each}}
</ul>
```

- `sort=field` sorts descending by that field
- `excludeCurrent=true` (default) excludes the current page from the loop
- Inside the loop, `{{fieldName}}` resolves against each item's frontmatter
- `{{route}}` is the cleaned URL path of the item

## Collections

Collections group pages together. Add `collections: posts` to a page's
frontmatter to include it in the `posts` collection.

A page can belong to multiple collections:

```yaml
collections: posts, featured
```

Collections are consumed by `{{#each}}` loops in layouts. The canonical
pattern is an index page that lists all pages in a collection — see
[example/pages/blog/index.md](../example/pages/blog/index.md).

## Public Assets

Files in `public/` are copied to the output root as-is. Use this for
CSS, JavaScript, images, fonts, and `favicon.ico`.

```
public/
  style.css        → dist/style.css
  favicon.svg      → dist/favicon.svg
  images/logo.png  → dist/images/logo.png
```

These files are never parsed or templated.

## Build & Dev

```bash
# One-shot build
bun run src/main.ts build \
  --source mysite/pages \
  --output mysite/dist \
  --layouts mysite/layouts \
  --public mysite/public

# Dev server with live reload (port 3000 by default)
bun run src/main.ts build \
  --source mysite/pages \
  --output mysite/dist \
  --layouts mysite/layouts \
  --public mysite/public \
  --dev

# Custom port
bun run src/main.ts build ... --dev --port 8080
```

- `--source` and `--output` are required
- `--layouts` and `--public` are optional
- Dev mode watches files, rebuilds on change, and reloads the browser via SSE

## Minimal Example

A two-page site in six files:

**mysite/pages/index.md**
```markdown
---
title: Home
layout: Home
---
Welcome to my site.
```

**mysite/pages/about.md**
```markdown
---
title: About
---
I write stuff.
```

**mysite/layouts/default.html**
```html
<!DOCTYPE html>
<html><head><title>{{title}}</title></head>
<body><slot/></body></html>
```

**mysite/layouts/Home.html**
```html
<default>
  <h1>{{title}}</h1>
  <slot/>
  <nav><a href="/about">About</a></nav>
</default>
```

**mysite/public/style.css**
```css
body { font-family: sans-serif; }
```

Build it:

```bash
bun run src/main.ts build --source mysite/pages --output mysite/dist \
  --layouts mysite/layouts --public mysite/public
```

Output:

```
mysite/dist/
  index.html          ← wraps index.md in Home.html → default.html
  about/index.html    ← wraps about.md in default.html
  style.css           ← copied from public/
```

That's it. For a full real-world example with collections, blog listings,
and a design system, see the [example site](../example/).
