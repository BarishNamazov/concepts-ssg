---
title: App Specification
layout: Blog
date: 2026-06-08
collections: docs
description: "Full specification of every concept and sync in the SSG, using the concept-design DSL with SSG instantiation."
---

## App Specification

Every concept in this static site generator is specified below using the concept-design DSL. Each section shows the abstract specification followed by the SSG instantiation — how the generic type parameters are filled and how each concept is positioned in the application.

## Quick Reference

### Concept Map

| Concept | Owns | Does not own |
|---|---|---|
| `CommandLine` | CLI invocation status, notices, terminal result | Build behavior |
| `Commanding` | Generic command issue/succeed/fail lifecycle | CLI parsing or build work |
| `Building` | Build status | File lists or output safety |
| `Coalescing` | One active request plus one queued follow-up per context | Build execution or file watching |
| `Filing` | File entries, text read/write, binary copy, output cleanup | Markdown, routes, layouts |
| `Frontmattering` | Metadata/body split for documents | Filesystem paths or rendering |
| `Formatting` | Source-to-HTML rendering | Layouts or routes |
| `Routing` | Entry-to-route derivation and collision checks | File reads or template output |
| `Layouting` | Layout definitions and composed HTML | Filesystem output or command status |
| `Collecting` | Entry membership in named collections | Template syntax ideally |
| `Serving` | Static HTTP serving and reload signals | Build orchestration |
| `Watching` | Watcher/change state | Filesystem driver details ideally |

### Sync Groups

| File | Role |
|---|---|
| `cli.sync.ts` | Parse CLI invocations, issue commands, link outcomes back to invocations |
| `build.sync.ts` | Reset state, configure routing, scan inputs, complete, clean, succeed |
| `discovery.sync.ts` | Fan out non-public scan results into per-entry reads |
| `content.sync.ts` | Parse frontmatter, render content, derive routes, collect metadata |
| `templates.sync.ts` | Define layouts, apply layouts, regenerate collection index pages |
| `output.sync.ts` | Convert composed pages into file writes |
| `assets.sync.ts` | Copy public entries as opaque bytes |
| `errors.sync.ts` | Fail commands on scan errors |
| `pipeline-errors.sync.ts` | Fail commands on read/write/copy/render/apply/derive errors |
| `dev.sync.ts` | Start dev server/watchers, serialize rebuilds, reload browsers |
| `reporting.sync.ts` | Aggregate and print build stats |

### Build Flow

```txt
CommandLine.invoke
  → Commanding.issue("build")
  → Building.start
  → Filing.scan(layouts) → Filing.scan(content) → Filing.scan(public)
  → text-entry cascades (parse → render | route | collect → layout → write)
  → public asset copies
  → Building.complete
  → Filing.cleanOutput
  → Commanding.succeed
```

### Per-Entry Flow

```txt
Filing.read
  → Frontmattering.parse
      → Formatting.render
      → Routing.derive
      → Collecting.collect
  → Layouting.apply
  → Filing.write
```

### Public Asset Flow

```txt
Filing.scan(public)
  → Filing.copy
```

### Dev Flow

```txt
Commanding.issue("dev")
  → Serving.start
  → Watching.start
  → Coalescing.request(initial) → Commanding.issue("build")
  → on change: Coalescing.request(change)
      → serialized Commanding.issue("build") → Serving.reload
```

---

## Detailed Concept Specifications

### Building

```
concept Building

purpose
  track whether a production run across multiple inputs completed
  successfully or failed

principle
  after a build is started, it is in RUNNING status; when all
  processing succeeds the build becomes SUCCEEDED, and when any
  required processing fails it becomes FAILED with an explanation

state
  a set of Builds with
    a status (RUNNING | SUCCEEDED | FAILED)
    an error String

actions
  start ()
    requires nothing
    effects a new build is created in RUNNING status

  complete (build: Build): (build: Build)
    requires build exists and is RUNNING
    effects build transitions to SUCCEEDED

  fail (build: Build, error: String): (build: Build)
    requires build exists and is RUNNING
    effects build transitions to FAILED with the error

queries
  _getStatus (build: Build): (status: String, error?: String)
    effects returns status and optional error for the build
```

> **SSG:** Build identity is `freshID()`. One build frames one `bun run example:build` or dev rebuild. `Building.complete` is the barrier for index regen and cleanup.

---

### Coalescing

```
concept Coalescing [Context]

purpose
  serialize repeated requests for a context while retaining at most
  one follow-up request when work is already active

principle
  after a request starts work for a context, later requests made
  before that work finishes are coalesced into one pending request;
  finishing active work either starts that pending request or returns
  the context to idle

state
  a set of Contexts with
    an active Bool
    a pending Bool
    an optional pendingKind String

actions
  request (context: Context, kind: String):
    (context: Context, kind: String, started: Bool)
    requires context is provided
    effects if context is idle, marks it active and returns started

  request (context: Context, kind: String):
    (context: Context, kind: String, queued: Bool)
    requires context is provided
    effects if context is active, records one pending request

  finish (context: Context):
    (context: Context, kind: String, started: Bool)
    requires context has active work
    effects if a request was queued, clears pending and starts one
      coalesced follow-up

  finish (context: Context): (context: Context, idle: Bool)
    requires context has active work
    effects if no request was queued, marks context idle

queries
  _get (context: Context):
    (active: Bool, pending: Bool, pendingKind?: String)
```

> **SSG:** Context = dev command. `dev.sync.ts` uses this to prevent overlapping in-process rebuilds: rapid watch events produce at most one active build and one queued follow-up build.

---

### Collecting

```
concept Collecting [Entry]

purpose
  group entries into named collections, each carrying a flat
  mapping of metadata keyed by string

principle
  after entries are collected into a named collection, all members
  and their metadata can be retrieved by collection name

state
  a set of Entries with
    a collections set of String
    a metadata Record<String, String>

actions
  collect (entry: Entry, collections: set of String,
           metadata: Record<String, String>): (entry: Entry)
    requires nothing
    effects stores collections and merges metadata for the entry;
      replaces previous collections

  clear ()
    requires nothing
    effects removes all collected entries

  remove (entry: Entry): (entry: Entry)
    requires entry exists
    effects removes entry from all collections

  updateMetadata (entry: Entry, metadata: Record<String, String>):
    (entry: Entry)
    requires entry exists
    effects merges metadata without changing collections;
      creates entry if missing

queries
  _getEntries (collection: String): (entry: Entry,
    metadata: Record<String, String>)
    effects returns all entries in the given collection with metadata
```

> **SSG:** Entry = Filing entry ID. Frontmatter `collections: posts` becomes `Collecting.collect`. Index pages query `_getEntries("posts")` for listing pages.

---

### Commanding

```
concept Commanding

purpose
  let a caller initiate an operation and determine whether
  it completed

principle
  after a caller issues a command, the command is assigned an
  identity; when processing succeeds the command becomes succeeded
  with a result, and when processing cannot complete it becomes
  failed with an explanation

state
  a set of Commands with
    a name String
    an args Record<String, String>
    a status (PENDING | SUCCEEDED | FAILED)
    a result String
    an error String

actions
  issue (name: String, args: Record<String, String>):
    (command: Command, name: String)
    requires nothing
    effects creates a new command in PENDING status

  succeed (command: Command, result?: String): (command: Command)
    requires command exists and is PENDING
    effects command transitions to SUCCEEDED with optional result

  fail (command: Command, error: String): (command: Command)
    requires command exists and is PENDING
    effects command transitions to FAILED with the error

queries
  _get (command: Command): (name: String,
    args: Record<String, String>, status: String,
    result?: String, error?: String)
    effects returns full command state
```

> **SSG:** Command identity is the correlation token between CLI and build lifecycle. `Commanding.issue("build", { source, output, layouts, public })` starts the build pipeline.

---

### CommandLine

```
concept CommandLine [Operation]

purpose
  represent a command-line invocation and communicate its lifecycle
  to the human operator

principle
  after a caller invokes the CLI with arguments, the invocation is
  created in PENDING status; when the associated operation completes
  the invocation transitions to SUCCEEDED, and when it fails the
  invocation transitions to FAILED with the error and optional usage

state
  a set of Invocations with
    an argv seq of String
    a status (PENDING | READY | SUCCEEDED | FAILED)
    a message String
    an error String
    a usage String
    a waitingFor Operation
    a mode String

actions
  invoke (argv: seq of String):
    (invocation: Invocation, argv: seq of String)
    requires nothing
    effects creates invocation in PENDING status

  waitFor (invocation: Invocation, operation: Operation,
            mode: String): (invocation: Invocation, command: Operation)
    requires invocation exists and is PENDING
    effects records the operation being waited on and the mode

  ready (invocation: Invocation, message?: String):
    (invocation: Invocation, message: String)
    requires invocation exists and is not terminal
    effects marks invocation READY

  notice (invocation: Invocation, message: String, level?: String):
    (invocation: Invocation, message: String, level: String)
    requires invocation exists
    effects stores a notice without changing invocation status

  succeed (invocation: Invocation, message?: String):
    (invocation: Invocation, message: String)
    requires invocation exists and is not terminal
    effects marks invocation SUCCEEDED

  fail (invocation: Invocation, error: String, usage?: String):
    (invocation: Invocation, message: String, usage: String)
    requires invocation exists and is not terminal
    effects marks invocation FAILED with error and optional usage

queries
  _getByOperation (operation: Operation): (invocation: Invocation)
    effects returns invocation matching the given operation

  _getInvocation (invocation: Invocation):
    (argv: seq of String, status: String, waitingFor?: Operation,
     mode?: String, message?: String, error?: String, usage?: String)
    effects returns full invocation state
```

> **SSG:** Operation = Command. `CommandLine.invoke({ argv })` is the single root action. `waitFor` links invocation to command outcome.

---

### Filing

```
concept Filing [Entry]

purpose
  discover, read, write, and copy files, and track which files
  exist in the output directory

principle
  after scanning a directory for files matching a pattern, those
  files become known entries; after reading an entry, its text
  content is available; after writing text content or copying bytes,
  the file exists in the output directory

state
  a set of Entries with
    a path String
    an extension String
    a root String
    an outputDirectory String
    an optional content String
    a written Bool
    an outputPath String
    a source String

actions
  scan (directory: String, patterns: seq of String,
        outputDirectory: String, source: String):
    (source: String, entries: seq of Entry)
    requires directory exists
    effects discovers files matching glob patterns;
      creates entry records for each

  read (entry: Entry): (entry: Entry, content: String)
    requires entry exists
    effects reads text from disk, stores content in entry state

  write (entry: Entry, outputRelativePath?: String):
    (entry: Entry, outputPath: String)
    requires entry exists and has content and an output directory
    effects writes text content to output directory at given relative path

  copy (entry: Entry, outputRelativePath?: String):
    (entry: Entry, outputPath: String)
    requires entry exists and has an output directory
    effects streams source bytes to output directory at given relative path;
      does not read or store content

  setContent (entry: Entry, content: String): (entry: Entry)
    requires entry exists
    effects sets content on the entry in memory

  clear ()
    requires nothing
    effects removes all entries and their state

  cleanOutput (outputDirectory: String): (removed: Number)
    requires output directory provided
    effects removes files not tracked as written entries,
      then removes empty directories

queries
  _getEntry (entry: Entry): (path: String, extension: String,
    root: String, outputDirectory: String, content?: String,
    outputPath?: String, written: Bool, source: String)

  _getAll (): (entry: Entry, path: String, extension: String,
    source: String)

  _getByExtension (extension: String):
    (entry: Entry, path: String, extension: String)

  _getContent (entry: Entry): (content: String)

  _getBySource (source: String):
    (entry: Entry, path: String, extension: String)

  _getConfig (): (outputDirectory: String)
```

> **SSG:** Entry is the polymorphic file identity type. Source tag (`"content"`, `"layouts"`, `"public"`) routes entries down different sync pipelines. Content and layout entries use text read/write; public entries use byte-safe copy.

---

### Formatting

```
concept Formatting [Entry]

purpose
  convert source text in a given format to HTML

principle
  after rendering a source string in markdown format, the resulting
  HTML is retrievable by the same entry identity

state
  a set of Entries with
    a source String
    a format String
    an html String

actions
  render (entry?: Entry, source: String, format: String):
    (entry: Entry, html: String)
    requires format is "html" or "markdown"
    effects renders source to HTML, stores result under entry identity

  remove (entry: Entry): (entry: Entry)
    requires entry exists
    effects removes the formatted entry and its rendered HTML

  clear ()
    requires nothing
    effects removes all formatted entries

queries
  _getHtml (entry: Entry): (html: String)

  _getSource (entry: Entry): (source: String, format: String)
```

> **SSG:** Entry = Filing entry ID. Source is the markdown body from Frontmattering. `.md` → markdown render; `.html` → pass through. Rendered HTML is later joined with route by `Layouting.apply`.

---

### Frontmattering

```
concept Frontmattering [Document]

purpose
  let metadata travel with a textual document while remaining
  independently accessible from its body

principle
  after parsing a document with a fenced metadata header, the
  metadata fields and clean body can be retrieved separately

state
  a set of Documents with
    a raw String
    a frontmatter String
    a body String
    a fields Record<String, any>
    a parseError String

actions
  parse (entry: Entry, raw: String): (entry: Entry)
    requires nothing
    effects splits document into YAML frontmatter fields and body;
      captures parse errors without throwing

  clear ()
    requires nothing
    effects removes all parsed documents

  remove (entry: Entry): (entry: Entry)
    requires entry exists
    effects removes the document and its parsed state

queries
  _getBody (entry: Entry): (body: String)

  _getFrontmatter (entry: Entry): (frontmatter: String)

  _getField (entry: Entry, field: String):
    (value: String | Number | Bool)

  _getAllFields (entry: Entry):
    (fields: Record<String, String | Number | Bool>)

  _getParseErrors (): (entry: Entry, error: String)
```

> **SSG:** Document = Filing entry ID. Body feeds `Formatting.render`. Fields (title, layout, date, collections) feed `Routing.derive`, `Collecting.collect`, and `Layouting.apply`.

---

### Layouting

```
concept Layouting [Entry, Layout]

purpose
  define HTML layouts and apply them to entries with typed
  variables and sequences

principle
  after a layout is defined from an HTML template and applied to an
  entry with variables and optional sequences, the composed HTML
  reflects variable substitution, component resolution, and
  {{#each}} sequence iteration

state
  a set of Layouts with
    a name String
    a source String
  a set of LayoutDependencies with
    a name String
    uses set of String
  a set of Compositions with
    a composed String
  a set of Entries with
    a layoutName String
    a composed String
  a nameIndex mapping String to Layout

actions
  define (name: String, source: String): (layout: Layout)
    requires name is non-empty
    effects creates/updates layout definition; parses sub-layout
      dependencies; updates name index

  compose (layoutName: String):
    (layoutName: String, composed: String)
    requires layout exists
    effects resolves full layout hierarchy, stores composed result

  apply (entry: Entry, layoutName: String,
          variables: TemplateVariables,
          sequences?: TemplateSequences):
    (entry: Entry, composed: String)
    requires nothing
    effects resolves layout hierarchy, substitutes variables,
      processes {{#each}} blocks, stores composed HTML

  remove (name: String): (name: String)
    requires layout exists
    effects removes layout, dependencies, compositions, name index

  clear ()
    requires nothing
    effects clears all state

queries
  _getLayout (name: String): (layout: Layout, name: String,
    source: String)

  _getUses (layout: Layout): (name: String)

  _getComposed (entry: Entry): (composed: String)

  _getSequenceRequests (layoutName: String, content: String):
    (collection: String, sortBy?: String)
```

> **SSG:** Entry = Filing entry ID; Layout = `freshID()`. Layout files `example/layouts/*.html` → `Layouting.define`. Variables come from frontmatter fields.

---

### Routing

```
concept Routing [Entry]

purpose
  assign stable, unambiguous public routes to entries

principle
  after a routing scheme is configured and an entry is assigned
  a file path, the entry has one derived public route; assigning
  another entry that would use the same route is rejected

state
  a set of Entries with
    a filePath String
    a route String
  a Config with
    a stripPrefix String
    an indexName String

actions
  configure (stripPrefix?: String, indexName?: String): ()
    requires nothing
    effects sets routing config for subsequent derivations

  derive (entry: Entry, filePath: String):
    (entry: Entry, route: String)
    requires nothing
    effects strips prefix and extension, normalizes to clean URL,
      checks for collisions; returns error on collision

  clear ()
    requires nothing
    effects removes all entry-to-route assignments; config is not
      affected

  remove (entry: Entry): (entry: Entry)
    requires entry exists
    effects removes the entry and its assigned route

queries
  _getConfig (): (stripPrefix: String, indexName: String)

  _getRoute (entry: Entry): (route: String)

  _getByRoute (route: String): (entry: Entry)
```

> **SSG:** Entry = Filing entry ID. `pages/blog/post.md` with prefix `pages/` → `/blog/post`. Route feeds `Layouting.apply` and output file path derivation. `clear()` is called alongside `Filing.clear()` and `Collecting.clear()` at the start of every build to prevent stale route collisions on rebuilds.

---

### Serving

```
concept Serving

purpose
  serve static files over HTTP and push reloads to connected
  browsers when content changes

principle
  after a server starts serving a root directory, connected
  browsers receive page content; when reload is called, all
  browsers connected to that server refresh

state
  a set of Servers with
    a port Number
    a root String
    a set of connected Clients

actions
  start (port: Number, root: String): (server: ServerId)
    requires root exists and port is available
    effects starts HTTP server serving files from root;
      directory requests resolve to index.html;
      content type is computed from the resolved file path;
      SSE endpoint enables live reload

  reload (server?: ServerId): (reloaded: Number)
    requires server exists (if specified)
    effects sends reload signal to all connected browsers via SSE

  stop (server: ServerId): (server: ServerId)
    requires server exists
    effects stops server and disconnects all clients

queries
  _getServer (server: ServerId): (port: Number, root: String)
```

> **SSG:** No type params. Dev mode starts on output dir (`example/dist/`) at port 3000. HTML responses, including clean directory URLs such as `/blog`, get the live-reload script. `Serving.reload` fires after scheduled change rebuilds complete.

---

### Watching

```
concept Watching [Subject, Context]

purpose
  detect when a subject's state has changed since it was
  last observed

principle
  after a watcher is started with an initial snapshot, polling
  with a new snapshot records a change event when the snapshots
  differ; polling with the same snapshot reports no change

state
  a set of Watchers with
    a subject Subject
    a context Context
    a lastSnapshot String
    a status (ACTIVE | STOPPED | FAILED)
    an error String
  a set of Changes with
    a watcher Watcher
    a detectedAt DateTime
    a snapshot String

actions
  create (subject: Subject, initialSnapshot?: String):
    (watcher: Watcher)
    requires nothing
    effects creates a watcher in STOPPED status

  start (subject: Subject, context?: Context,
          initialSnapshot?: String):
    (watcher: Watcher, subject: Subject, context: Context)
    requires nothing
    effects creates a watcher in ACTIVE status

  observe (watcher: Watcher, snapshot: String): (watcher: Watcher)
    requires watcher exists and is ACTIVE
    effects updates last snapshot without creating a change event

  poll (watcher: Watcher, currentSnapshot: String):
    (change: Change, watcher: Watcher, subject: Subject,
     context: Context, snapshot: String)
    requires watcher exists and is ACTIVE
    effects compares snapshots; if different, records change event
      and updates last snapshot; if same, returns unchanged

  fail (watcher: Watcher, error: String):
    (watcher: Watcher, subject: Subject, context: Context,
     error: String)
    requires watcher exists
    effects marks watcher FAILED with the error

  stop (watcher: Watcher): (watcher: Watcher)
    requires watcher exists and is ACTIVE
    effects marks STOPPED, removes associated changes

  remove (watcher: Watcher): (watcher: Watcher)
    requires watcher exists
    effects removes watcher and all change records

queries
  _getChanges (watcher: Watcher):
    (change: Change, detectedAt: String, snapshot: String)

  _getWatcher (watcher: Watcher): (subject: Subject,
    lastSnapshot: String, context: Context, status: String,
    error?: String)

  _getByContext (context: Context):
    (watcher: Watcher, subject: Subject, status: String)
```

> **SSG:** Subject = `string` (directory path). Context = Command from Commanding. Separate watchers per directory (source, layouts, public). Poll snapshot is hashed file paths + mtimes.

---

## Synchronizations

The concept DSL also has a notation for synchronizations. Each sync is a `when`/`where`/`then` rule. The full set of syncs that compose the SSG is specified below.

### CLI Invocation Syncs

```
sync CliInvokeBuild
when
  CommandLine.invoke (argv: ["build", ...]) : (invocation)
then
  Commanding.issue (name: "build", args: { source, output, layouts, public })
```

```
sync CliInvokeDev
when
  CommandLine.invoke (argv: ["dev", ...]) : (invocation)
then
  Commanding.issue (name: "dev", args: { source, output, layouts, public, port })
```

```
sync CliInvalid
when
  CommandLine.invoke (argv) : (invocation, argv)
where
  argv does not parse to a valid subcommand or is missing required arguments
then
  CommandLine.fail (invocation, error: "...", usage: "...")
```

```
sync CliWaitBuildComplete
when
  CommandLine.invoke () : (invocation)
  Commanding.issue (name: "build") : (command)
then
  CommandLine.waitFor (invocation, command, "complete")
```

```
sync CliWaitDevReady
when
  CommandLine.invoke () : (invocation)
  Commanding.issue (name: "dev") : (command)
then
  CommandLine.waitFor (invocation, command, "ready")
```

```
sync WaitForCompleteSucceed
when
  CommandLine._getByOperation (operation: command) : (invocation)
  Commanding.succeed (command)
then
  CommandLine.succeed (invocation)
```

```
sync WaitForCompleteFail
when
  CommandLine._getByOperation (operation: command) : (invocation)
  Commanding.fail (command)
then
  CommandLine.fail (invocation, error)
```

```
sync WaitForReadySucceed
when
  CommandLine._getByOperation (operation: command) : (invocation)
  Commanding.succeed (command)
where
  invocation mode is "ready"
then
  CommandLine.ready (invocation)
```

```
sync WaitForReadyFail
when
  CommandLine._getByOperation (operation: command) : (invocation)
  Commanding.fail (command)
where
  invocation mode is "ready"
then
  CommandLine.fail (invocation, error)
```

### Build Lifecycle Syncs

```
sync BuildCommandStartsBuild
when
  Commanding.issue (name: "build") : (command)
then
  Building.start ()
```

```
sync BuildStartedRunsPipeline
when
  Commanding.issue (name: "build") : (command, args: { source, output, layouts, public })
  Building.start () : (build)
then
  Filing.clear ()
  Collecting.clear ()
  Frontmattering.clear ()
  Routing.clear ()
  Routing.configure (stripPrefix: args.source, indexName: "index")
  Filing.scan (directory: args.layouts, patterns: ["**/*.html"], outputDirectory: args.output, source: "layouts")
  Filing.scan (directory: args.source, patterns: ["**/*.md", "**/*.html"], outputDirectory: args.output, source: "content")
  Filing.scan (directory: args.public, patterns: ["**/*"], outputDirectory: args.output, source: "public")
  Building.complete (build)
  Filing.cleanOutput (outputDirectory: args.output)
  Commanding.succeed (command)
```

### Discovery Syncs

```
sync ScanTriggersRead
when
  Filing.scan () : (source, entries)
where
  source is not "public"
  for each entry in entries:
then
  Filing.read (entry)
```

### Content Processing Syncs

```
sync ReadTriggersParse
when
  Filing.read (entry) : (entry, content)
where
  in Filing: entry source is "content"
then
  Frontmattering.parse (entry, raw: content)
```

```
sync ParseTriggersRender
when
  Frontmattering.parse (entry) : (entry)
where
  in Frontmattering: _getBody(entry) gets body
  entry file extension determines format (".md" | ".html")
then
  Formatting.render (entry, source: body, format)
```

```
sync ParseTriggersRoute
when
  Frontmattering.parse (entry) : (entry)
where
  in Filing: _getEntry(entry) gets path
then
  Routing.derive (entry, filePath: rootRelative(path))
```

```
sync ParseTriggersCollect
when
  Frontmattering.parse (entry) : (entry)
where
  in Frontmattering: _getAllFields(entry) gets fields
  collections list is extracted from fields or defaults to []
  metadata is all remaining fields
then
  Collecting.collect (entry, collections, metadata)
```

```
sync RouteTriggersUpdateIndex
when
  Routing.derive (entry) : (entry, route)
then
  Collecting.updateMetadata (entry, metadata: { route })
```

```
sync ParseErrorNotices
when
  CommandLine._getByOperation (operation: command) : (invocation)
  Frontmattering._getParseErrors () : (entry, error)
then
  CommandLine.notice (invocation, message: "Parse error in ${entry}: ${error}", level: "error")
```

### Template Syncs

```
sync LayoutReadTriggersDefine
when
  Filing.read (entry) : (content)
where
  in Filing: entry source is "layouts"
  layout name is derived from file path
then
  Layouting.define (name, source: content)
```

```
sync RenderAndRouteTriggersApply
when
  Formatting.render (entry) : (entry)
  Routing.derive (entry) : (entry)
where
  in Formatting: _getHtml(entry) gets html
  in Frontmattering: _getAllFields(entry) gets fields
  layout name is resolved from fields.layout or defaults
  template variables are built from fields + html as body
then
  Layouting.apply (entry, layoutName, variables)
```

```
sync FinalizeTriggersIndexRegen
when
  Building.complete () : (build)
where
  in Filing: _getAll() gets all entries
  for each entry:
    in Layouting: _getSequenceRequests(layoutName, content) gets collection requests
    for each collection request:
      in Collecting: _getEntries(collection) gets member entries with metadata
      sequences are built as typed arrays from member entries
      variables are built from entry frontmatter fields
then
  Layouting.apply (entry, layoutName, variables, sequences)
```

### Output Syncs

```
sync ApplyTriggersWrite
when
  Layouting.apply (entry) : (entry)
where
  in Layouting: _getComposed(entry) gets composed
  in Routing: _getRoute(entry) gets route
  outputRelativePath is route converted to a filesystem path (e.g. /blog/post → blog/post/index.html)
then
  Filing.setContent (entry, content: composed)
  Filing.write (entry, outputRelativePath)
```

### Asset Syncs

```
sync PublicScanTriggersCopy
when
  Filing.scan () : (source: "public", entries)
where
  for each entry in entries:
then
  Filing.copy (entry)
```

### Error Syncs

```
sync ScanErrorFailsBuild
when
  Building._get (build) : (status: "RUNNING")
  Filing.scan () : (error)
then
  Building.fail (build, error)
  Commanding.fail (command, error)
```

```
sync ReadErrorFailsBuild
when
  Building._get (build) : (status: "RUNNING")
  Filing.read () : (error)
then
  Building.fail (build, error)
  Commanding.fail (command, error)
```

```
sync WriteErrorFailsBuild
when
  Building._get (build) : (status: "RUNNING")
  Filing.write () : (error)
then
  Building.fail (build, error)
  Commanding.fail (command, error)
```

```
sync CopyErrorFailsBuild
when
  Building._get (build) : (status: "RUNNING")
  Filing.copy () : (error)
then
  Building.fail (build, error)
  Commanding.fail (command, error)
```

```
sync RenderErrorFailsBuild
when
  Building._get (build) : (status: "RUNNING")
  Formatting.render () : (error)
then
  Building.fail (build, error)
  Commanding.fail (command, error)
```

```
sync ApplyErrorFailsBuild
when
  Building._get (build) : (status: "RUNNING")
  Layouting.apply () : (error)
then
  Building.fail (build, error)
  Commanding.fail (command, error)
```

```
sync DeriveErrorFailsBuild
when
  Building._get (build) : (status: "RUNNING")
  Routing.derive () : (error)
then
  Building.fail (build, error)
  Commanding.fail (command, error)
```

```
sync SetContentErrorFailsBuild
when
  Building._get (build) : (status: "RUNNING")
  Filing.setContent () : (error)
then
  Building.fail (build, error)
  Commanding.fail (command, error)
```

```
sync CleanOutputErrorFailsBuild
when
  Building._get (build) : (status: "RUNNING")
  Filing.cleanOutput () : (error)
then
  Building.fail (build, error)
  Commanding.fail (command, error)
```

### Dev Mode Syncs

```
sync DevStart
when
  Commanding.issue (name: "dev", args: { source, output, layouts, public, port }) : (command)
then
  Serving.start (port, root: output)
  Watching.start (subject: source, context: command)
  Coalescing.request (context: command, kind: "initial")
```

```
sync CoalescedRequestStartsBuild
when
  Coalescing.request (context, kind) : (started)
where
  in Commanding: _get(context) gets original dev args
  build args are original dev args plus _devContext and _devKind
then
  Commanding.issue (name: "build", args: buildArgs)
```

```
sync CoalescedFollowUpStartsBuild
when
  Coalescing.finish (context) : (kind, started)
where
  in Commanding: _get(context) gets original dev args
  build args are original dev args plus _devContext and _devKind
then
  Commanding.issue (name: "build", args: buildArgs)
```

```
sync DevWatchLayouts
when
  Commanding.issue (name: "dev", args: { layouts }) : (command)
where
  layouts directory exists
then
  Watching.start (subject: layouts, context: command)
```

```
sync DevWatchPublic
when
  Commanding.issue (name: "dev", args: { public }) : (command)
where
  public directory exists
then
  Watching.start (subject: public, context: command)
```

```
sync DevInitialBuildReady
when
  Commanding.issue (name: "dev") : (command)
  Serving._getServer (command.server) : (port)
  Watching._getByContext (command) : (watchers with ACTIVE status)
  Commanding.succeed (devBuildCommand)
then
  CommandLine.notice (invocation, "Server running on port ${port}")
  Commanding.succeed (command)
```

```
sync DevInitialBuildFail
when
  Commanding.issue (name: "dev") : (command)
  Commanding.fail (devBuildCommand)
then
  CommandLine.notice (invocation, "Initial build failed", level: "error")
  Commanding.succeed (command)
```

```
sync DevStartFail
when
  Commanding.issue (name: "dev") : (command)
  Serving.start () : (error)
then
  Commanding.fail (command, error)
```

```
sync WatchErrorFailsDev
when
  Commanding.issue (name: "dev") : (command)
  Watching.start (context: command) : (error)
then
  Commanding.fail (command, error)
```

```
sync WatchRuntimeErrorFailsDev
when
  Watching.fail (context: command) : (error)
where
  command is the dev command
then
  Commanding.fail (command, error)
```

```
sync DevWatchRebuild
when
  Watching.poll (context: command) : (change, subject)
then
  Coalescing.request (context: command, kind: "change")
```

```
sync ScheduledBuildSucceedFinishes
when
  Commanding.issue (name: "build", args: { _devContext }) : (rebuildCommand)
  Commanding.succeed (rebuildCommand)
then
  Coalescing.finish (context: _devContext)
```

```
sync ScheduledBuildFailFinishes
when
  Commanding.issue (name: "build", args: { _devContext }) : (rebuildCommand)
  Commanding.fail (rebuildCommand) : (error)
then
  Coalescing.finish (context: _devContext)
```

```
sync DevRebuildSucceed
when
  Commanding.issue (name: "build", args: { _devContext, _devKind: "change" }) : (rebuildCommand)
  Commanding.succeed (rebuildCommand)
then
  Serving.reload ()
  CommandLine.notice (invocation, "Rebuilt site")
```

```
sync DevRebuildFail
when
  Commanding.issue (name: "build", args: { _devContext, _devKind: "change" }) : (rebuildCommand)
  Commanding.fail (rebuildCommand) : (error)
then
  CommandLine.notice (invocation, "Rebuild failed: ${error}", level: "error")
```

### Runtime Adapter Syncs

```
sync RuntimeCliReady
when
  CommandLine.ready (invocation, message)
then
  CommandLineRuntime.ready (invocation, message)
```

```
sync RuntimeCliNotice
when
  CommandLine.notice (invocation, message, level)
then
  CommandLineRuntime.notice (invocation, message, level)
```

```
sync RuntimeCliSucceed
when
  CommandLine.succeed (invocation, message)
then
  CommandLineRuntime.succeed (invocation, message)
```

```
sync RuntimeCliFail
when
  CommandLine.fail (invocation, message, usage)
then
  CommandLineRuntime.fail (invocation, message, usage)
```

```
sync RuntimeWatchStart
when
  Watching.start (watcher, subject, context)
then
  WatchRuntime.subscribe (watcher, subject, context)
```

```
sync RuntimeWatchObserve
when
  WatchRuntime.subscribe (watcher) : (snapshot)
then
  Watching.observe (watcher, snapshot)
```

```
sync RuntimeWatchSubscribeFail
when
  WatchRuntime.subscribe (watcher) : (error)
then
  Watching.fail (watcher, error)
```

```
sync RuntimeWatchStop
when
  Watching.stop (watcher)
then
  WatchRuntime.unsubscribe (watcher)
```

```
sync RuntimeWatchRemove
when
  Watching.remove (watcher)
then
  WatchRuntime.unsubscribe (watcher)
```

### Reporting Syncs

```
sync BuildReportStats
when
  CommandLine._getByOperation (operation: command) : (invocation)
  Building.complete () : (build)
where
  in Filing: _getBySource("content") gets content count
  in Filing: _getBySource("layouts") gets layout count
  in Filing: _getBySource("public") gets asset count
then
  CommandLine.notice (invocation, "Built ${contentCount} pages, ${layoutCount} layouts, ${assetCount} assets")
```

---

## App Instantiation Summary

The `createConcepts()` factory in `src/concepts/concepts.ts` creates one instance of each concept. The type parameters are filled as follows:

| Concept | Type Parameter | SSG Instantiation |
|---|---|---|
| Building | _(none)_ | Concrete concept; build identity is `freshID()` |
| Coalescing | Context | Dev command from Commanding |
| Collecting | Entry | Entry ID from Filing |
| Commanding | _(none)_ | Concrete concept; command identity is `freshID()` |
| CommandLine | Operation | Command from Commanding |
| Filing | Entry | Generated entry identity (`freshID()`) |
| Formatting | Entry | Entry ID from Filing |
| Frontmattering | Document | Entry ID from Filing |
| Layouting | Entry, Layout | Entry ID from Filing; layout identity is `freshID()` |
| Routing | Entry | Entry ID from Filing |
| Serving | _(none)_ | Concrete concept; server identity is `freshID()` |
| Watching | Subject, Context | Subject = `string` (directory path); Context = Command |

All entry-based concepts share the same Entry identity type, which enables the sync engine to join them — when `Frontmattering.parse` returns `{ entry }`, the same entry identity can be used to query `Formatting._getHtml`, `Routing._getRoute`, and `Collecting._getEntries`.

The 12 concepts are wired by 49 core app syncs across 11 sync files. `createApp()` also registers 9 runtime-adapter syncs across 2 runtime sync files, for 58 syncs at the CLI boundary. The full build emerges from one root action — `CommandLine.invoke({ argv })` — with no imperative orchestration. The sync engine journals every action, matches patterns within causal flows, and fires follow-up actions per surviving frame.
