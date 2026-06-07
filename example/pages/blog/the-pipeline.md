---
title: The Build Pipeline
layout: Blog
date: 2026-06-04
collections: posts
description: "How one CLI action expands into scans, per-file cascades, index regeneration, cleanup, and command reporting."
---

## The Build Pipeline

The build starts with one root action:

```ts
CommandLine.invoke({ argv: ["build"] })
```

Everything else is sync composition. This post follows the full execution from CLI input to terminal output.

## Stage 1: CLI to Command

`cli.sync.ts` inspects `argv` in a `where` clause, parses the subcommand, and issues a `Commanding.issue` action:

```
argv = ["build", "--source", "example/pages", "--output", "example/dist"]
  → Commanding.issue({ name: "build", args: { source, output, layouts, public } })
```

The invocation is linked to the command via `CommandLine.waitFor`. When the command later succeeds or fails, that outcome propagates back to the invoking process.

Invalid subcommands or missing required arguments trigger `CommandLine.fail` immediately.

## Stage 2: Build Initialization

`build.sync.ts` matches `Commanding.issue` with `name: "build"`. It extracts `source`, `output`, `layouts`, and `public` from the command args, then fires a sequence of setup actions:

```
Building.start
Filing.clear
Collecting.clear
Frontmattering.clear
Routing.configure
```

Each clear action resets a concept's state to prepare for a fresh build. `Routing.configure` sets the source prefix and index filename for later route derivation.

## Stage 3: Scanning

After initialization, the build sync fires three scans:

```
Filing.scan({ root: source, glob: "**/*.md" })
Filing.scan({ root: source, glob: "**/*.html" })
Filing.scan({ root: layouts, glob: "**/*.html" })
Filing.scan({ root: public, glob: "**/*" })
```

Each scan returns an array of entry IDs. The `Filing` concept stores each discovered file as an entry record with path, source tag, and modification time.

## Stage 4: Per-File Cascades

For each scan result, `discovery.sync.ts` fans out the entry array into one frame per entry, then fires `Filing.read`:

```ts
where: (frames) =>
  frames.flatMap((frame) => {
    const entryIds = frame[entries] as string[];
    return entryIds.map((id) => ({ ...frame, [entry]: id }));
  }),
then: actions([Filing.read, { entry }]),
```

From there, content.sync.ts takes over. For each content entry that was read:

```
Filing.read
  → Frontmattering.parse    // split YAML frontmatter from body
  → Formatting.render        // markdown → HTML
  → Routing.derive            // file path → clean URL
  → Collecting.collect        // store collection membership
```

Each of these happens independently. `Formatting.render` does not wait for `Routing.derive`. They both fire as soon as parsing completes.

Layout files follow a shorter path through `templates.sync.ts`:

```
Filing.read (layout file)
  → Layouting.define         // register the HTML template by name
```

## Stage 5: Layout Application

`templates.sync.ts` contains a join sync: `RenderAndRouteTriggersApply`. It fires when both `Formatting.render` and `Routing.derive` have completed for the same entry:

```ts
when: actions(
  [Formatting.render, {}, { entry }],
  [Routing.derive, { entry }, {}],
)
then: actions([Layouting.apply, { entry }])
```

`Layouting.apply` resolves the entry's layout, queries the rendered HTML and route, substitutes template variables, and produces final HTML as a new action output.

## Stage 6: Writing Output

`publishing.sync.ts` matches `Layouting.apply` and fires `Filing.write`:

```ts
then: actions([Filing.write, {
  entry,
  path: `${route}/index.html`,
  content: composedHtml,
}])
```

A page with route `/blog/post` writes to `example/dist/blog/post/index.html`.

## Stage 7: Index Regeneration

Collection index pages (like this blog listing) need data from every entry, so they must run after all entries are collected. The barrier is `Building.complete`.

`templates.sync.ts` matches `Building.complete`, queries all entries grouped by collection, and re-applies the layout for each index page:

```ts
when: actions([Building.complete, {}, {}]),
where: async (frames) => {
  // query Collecting for all entries per collection
  // find pages with type: index
  // inject collection entry data for the template loop
  return frames;
},
then: actions([Layouting.apply, { entry, collectionData }]),
```

## Stage 8: Cleanup and Completion

After index regeneration, the build sync fires:

```
Filing.cleanOutput   // remove files not produced by this build
Commanding.succeed   // mark the command successful
```

`cli.sync.ts` catches `Commanding.succeed` and propagates it to the waiting `CommandLine` invocation, which sets the process exit code to 0.

## The Gap

The current `BuildCommand` sync fires everything in one `then` list: scans, complete, cleanup, and succeed. If any scan returns an error, the success tail still runs. A build can fail to read files, render content, or derive routes, but still report success.

Fixing this requires splitting each stage into success-only syncs that gate on the previous stage's success. This is tracked in the [Sync Layer issues](/issues/sync-layer).

## Next

Read [From Markdown to Published Page](/blog/from-markdown-to-html) to follow a single file through every concept in the pipeline.
