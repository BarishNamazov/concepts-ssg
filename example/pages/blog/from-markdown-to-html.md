---
title: From Markdown to Published Page
layout: Blog
date: 2026-06-03
collections: posts
description: "A single content file moving through Filing, Frontmattering, Formatting, Routing, Collecting, Layouting, and back to Filing."
---

## From Markdown to Published Page

This post follows one markdown file through every concept in the generator. The file `example/pages/blog/concept-design-intro.md` works as an example, but the path is the same for any content page with frontmatter and a layout.

## 1. Filing Discovers the Entry

`Filing.scan` walks `example/pages/` with the glob `**/*.md`. It finds `blog/concept-design-intro.md` and creates an entry record:

```
{ _id: "entry-1", source: "content", path: "blog/concept-design-intro.md" }
```

The scan returns an array of all discovered entry IDs. A discovery sync fans that array out and fires one `Filing.read` per entry.

## 2. Filing Reads the File

`Filing.read({ entry: "entry-1" })` reads the file as UTF-8 text and stores it:

```ts
// On the entry record:
{ content: "---\ntitle: This Repo in One Pass\n...\n## This Repo in One Pass\n\n..." }
```

## 3. Frontmattering Splits Metadata from Body

`Frontmattering.parse({ entry: "entry-1", raw: content })` looks for the `---` fence, parses the YAML block, and stores two results:

```
fields: { title: "This Repo in One Pass", layout: "Blog", date: "2026-06-07", collections: "posts", description: "..." }
body: "## This Repo in One Pass\n\nThe project builds a static site generator..."
```

The fence detection looks for lines that start with `---`. The close-fence check is a simple `indexOf("\n---")` which can match mid-line content — a known issue tracked in [Parsing Issues](/issues/parsing-validation).

## 4. Formatting Renders Markdown to HTML

`Formatting.render({ entry: "entry-1", body })` passes the body through the `marked` library:

```
"## This Repo in One Pass\n\nThe project builds..."
  → "<h2>This Repo in One Pass</h2>\n<p>The project builds..."
```

The formatter stores the HTML keyed by entry. It does not know about routes, layouts, or files.

## 5. Routing Derives a URL

`Routing.derive({ entry: "entry-1", filePath: "blog/concept-design-intro.md" })` applies the configured prefix and index rules:

```
"blog/concept-design-intro.md"
  → strip "blog/" prefix? (not configured)
  → strip ".md" extension
  → check: is index? (no, filename is not "index")
  → route: "/blog/concept-design-intro"
```

Routing also checks for collisions. If another entry already uses `/blog/concept-design-intro`, `derive` returns `{ error: "route collision" }`.

## 6. Collecting Records Collection Membership

`Collecting.collect({ entry: "entry-1", collections: ["posts"], metadata: { title, date, description } })` stores:

```
collection: "posts"
entry: "entry-1"
metadata: { title: "This Repo in One Pass", date: "2026-06-07", description: "..." }
```

This is what powers `<ul>{{#each posts}}<li>{{title}}</li>{{/each}}</ul>` on index pages. The collection query returns all entries in the group with their metadata.

## 7. Layouting Applies the Layout

Layout application waits until both `Formatting.render` and `Routing.derive` have completed. The join sync fires `Layouting.apply`:

`Layouting.apply({ entry: "entry-1" })` does three things:

1. Looks up the entry's layout field: `"Blog"`
2. Loads the layout definition: the `Blog.html` template
3. Substitutes variables: `{{title}}` → `"This Repo in One Pass"`, `{{content}}` → the rendered HTML from Formatting

The layout `Blog.html` embeds the result inside `BaseLayout` with `Header` and `Footer` components, producing the final HTML page.

## 8. Filing Writes the Output File

`Filing.write({ entry: "entry-1", path: "blog/concept-design-intro/index.html", content: finalHtml })` creates:

```
example/dist/blog/concept-design-intro/index.html
```

The path is derived from the route: `/blog/concept-design-intro` → `blog/concept-design-intro/index.html`.

## What This Demonstrates

No single concept owns the full journey from file to HTML. The file entry does not have a `publish()` method. Each concept owns one relation over the entry identity:

- `Filing` owns the file path and content
- `Frontmattering` owns the metadata/body split
- `Formatting` owns the rendered HTML
- `Routing` owns the URL
- `Collecting` owns group membership
- `Layouting` owns the composed page

The page is a join over all those relations, and the syncs are the join conditions.

## Next

Read the [Friction Log](/blog/friction-log) to see where this design is still sharp around the edges.
