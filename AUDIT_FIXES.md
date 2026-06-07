# Static Site Generator Concept-Design Audit

## Remediation Progress

### Phase 1: Immediate Runtime Fixes ✅ COMPLETED (2026-06-06)

- [x] **Finding 1 (Command lifecycle):** `CommandingConcept` redesigned with `issue`/`succeed`/`fail` actions and `_get` query. Commands track PENDING/SUCCEEDED/FAILED status. Status transitions are idempotent-protected (only transition from PENDING).
- [x] **Finding 1 (Error propagation):** Sync `when` patterns match explicit success outputs (`{ entries }` instead of `{}`). `ScanErrorFailsBuild` sync catches scan errors and calls `Commanding.fail`. CLI exits nonzero on FAILED status.
- [x] **Finding 2 (Scan-to-entry correlation):** `Filing.scan` returns `{ source, entries }` with discovered entry IDs. `ScanTriggersRead` fans out from these scan-specific entries instead of `_getAll()`.
- [x] **Finding 3 (No-layout behavior):** Implemented Option B (layouts optional). `Layouting.apply` falls through to raw HTML when layout not found. Empty layout directory returns success with no entries.
- [x] **Finding 4 (Route collisions):** `Routing.derive` checks for existing route assignments and returns `{ error }` on collision. Added `remove` action. Prefix normalization strips trailing separators.
- [x] **Finding 5 (Output snapshot):** Deferred to Phase 5 (Publishing concept).
- [x] **Finding 6 (Collecting):** `Collecting.collect` now replaces collections instead of unioning (fixes stale membership bug).
- [x] **Finding 7 (Index regen):** Deferred to Phase 4 (Build lifecycle).
- [x] **Finding 8 (Filing conflation):** `Filing.read` no longer requires `directory` — uses scan root stored per entry.
- [x] **Finding 9 (Layouting):** Fixed empty slot content bug (`!== undefined` check instead of falsy). Deferred rename to Phase 6.
- [x] **Finding 10 (Formatting):** Deferred to Phase 3 (concept lifecycles).
- [x] **Finding 11 (Frontmatter):** Deferred to Phase 6 (real YAML or documented syntax).
- [x] **Finding 12 (Sync correlation):** `RenderAndRouteTriggersApply` now binds `entry` explicitly in both `when` clauses.
- [x] **Finding 13 (Test isolation):** Tests use `createConcepts()` + `createSyncs()` factory pattern. Each test gets a fresh isolated app instance.

### Phase 2: Test Isolation ✅ COMPLETED
- [x] Sync factory: `createSyncs(concepts)` exported from `src/syncs/app.ts`
- [x] Each integration test creates fresh `createConcepts()` + `createSyncs(app)` + `Engine.register(syncs)`
- [x] No singleton concept leaks between tests
- [x] Added regression tests for: missing source directory, missing layouts, route collisions, scan-specific reads, test isolation

### Remaining Phases
- [x] Phase 3: Repair Concept Lifecycles ✅ (added remove/clear to Formatting, Layouting, Frontmattering, Collecting)
- [x] Phase 4: Build Lifecycle ✅ (Building concept replaces Collecting.finalize; build completion triggers index regen)
- [x] Phase 5: Publishing Snapshot ✅ (Publishing concept created; Filing.cleanOutput removes stale files after build; stores outputPath on entries)
- [ ] Phase 6: Template & Metadata Models (Templating rename, real YAML, structured data, escaping)
- [ ] Phase 7: Documentation & Repository Cleanup

---

## Executive Summary

The current implementation is a promising static-site generator built from seven
concept classes and eleven synchronizations. It demonstrates the basic mechanics
of concept composition successfully:

- files are discovered and read;
- frontmatter is separated from page content;
- Markdown is converted to HTML;
- routes are derived from paths;
- layouts are defined and applied;
- collection data is gathered for index pages;
- rendered pages are written to disk.

The implementation also passes its current automated checks:

```text
bun test          91 pass, 0 fail
bun run typecheck clean
bun run check     clean
coverage          89.04% functions, 92.85% lines
```

Those results are mechanically accurate but materially overstate the system's
correctness. Clean-process probes exposed multiple user-visible failures:

1. A build without a layouts directory exits successfully, prints
   `Build complete.`, and writes no files.
2. A build whose source directory does not exist also exits successfully and
   prints `Build complete.`.
3. Every content scan attempts to reread all previously discovered layout files
   from the content directory.
4. Two source files that derive the same route silently overwrite one another.
5. Files removed from the source remain indefinitely in the output directory.

These are not isolated implementation mistakes. Most arise from weaknesses in
the current concept boundaries and synchronization model:

- `Commanding` emits an event but does not model command lifecycle or results.
- `Filing` mixes file discovery, mutable content buffers, output configuration,
  pipeline labels, and publication.
- `Collecting` is tailored to this application's frontmatter and template
  conventions rather than expressing an independent reusable concept.
- `Layouting` combines template definition, dependency resolution, component
  inclusion, iteration, variable interpolation, and rendered-page storage.
- the build pipeline uses action ordering and a no-op `finalize` action as an
  implicit batch-processing protocol.
- error results are generally ignored by synchronizations.

The recommended direction is not to add more procedural code to the large
`FinalizeTriggersIndexRegen` sync. The system needs a clearer model of:

- build runs and their status;
- file scans and which entries each scan discovered;
- category membership;
- template rendering;
- publication as an output snapshot;
- explicit success and failure propagation.

This document first explains each confirmed issue in detail, then proposes a
target concept model and a staged remediation plan.

---

## Audit Basis

The audit applies the repository's concept-design rules, especially the
following criteria.

### Independence

A concept must be understandable and useful without knowing which other
concepts happen to be present in this application.

Evidence of good independence includes:

- no imports from another concept;
- generic identities for externally allocated objects;
- no assumptions about another concept's fields;
- purposes and principles that do not describe application-specific pipelines;
- actions that make sense when the concept is used by itself.

The current concepts satisfy the narrow import rule, but several fail the
stronger semantic form of independence. For example, `Collecting` knows through
its documentation and API shape that metadata comes from frontmatter and is
consumed by an index-page template.

### Completeness

A concept must provide the full lifecycle needed to deliver its purpose.

This includes:

- actions for setup;
- actions for normal use;
- mutation or replacement actions where state can change;
- deletion, reset, or compensating actions where needed;
- state sufficient to enforce action preconditions;
- explicit failures when an action cannot fulfill its effects.

Several current concepts are fragments rather than complete behavioral units.
For example, `Commanding.command` accepts anything and has no notion of command
completion, failure, or status.

### Separation of Concerns

A concept should represent one coherent, reusable behavioral concern. State
components that can evolve independently are a warning that multiple concepts
have been combined.

`Filing` currently contains at least three separable concerns:

- discovering files;
- reading and mutating content;
- publishing content under an output directory.

`Layouting` similarly combines template composition and template rendering.

### Polymorphism

External object types must be treated as opaque identities. A concept should not
allocate an identity belonging to an external type parameter or assume that an
external object has application-specific properties.

`Formatting [Entry]` accepts an optional external `entry` but allocates one when
it is absent. That makes it unclear whether `Entry` is an external generic type
or an internal rendering entity.

### Declarative Synchronization

Synchronizations should state causal composition and policy:

```text
when an action succeeds
where relevant state relationships hold
then another action occurs
```

They should not become imperative workflow functions that:

- parse one concept's syntax directly;
- duplicate another concept's behavior;
- use global state as a batch barrier;
- depend on subtle action execution ordering;
- silently discard errors;
- compensate for missing concept lifecycle operations.

---

## Current System Map

### Concepts

| Concept | Current responsibility |
| --- | --- |
| `Commanding` | Receives generic CLI command names and argument dictionaries |
| `Filing` | Scans directories, reads files, stores mutable content, and writes output |
| `Frontmattering` | Splits frontmatter from body and parses scalar metadata |
| `Formatting` | Converts Markdown to HTML or passes HTML through |
| `Routing` | Derives URL routes from file paths |
| `Layouting` | Defines layouts, resolves components, expands loops, interpolates variables, and stores composed output |
| `Collecting` | Stores collection membership and copied metadata for later index generation |

### Synchronization Flow

The current root flow is:

```text
Commanding.command("build")
  -> clear selected state
  -> configure routing
  -> scan layouts
     -> query all files
     -> read each file
     -> define layouts
  -> scan content
     -> query all files
     -> read each file
     -> parse frontmatter
     -> render content
     -> derive route
     -> copy metadata into Collecting
     -> apply layout
     -> write page
  -> Collecting.finalize()
     -> rediscover index pages
     -> parse template syntax inside the sync
     -> query copied collection metadata
     -> apply layouts again
     -> write index pages again
```

The broad flow works for the example site when layouts exist and no serious
errors occur. The details below explain why it is fragile.

---

## Finding 1: Build Failures Are Reported as Success

**Severity:** Critical

**Primary files:**

- `src/concepts/Commanding/CommandingConcept.ts`
- `src/syncs/app.ts`
- `src/main.ts`

### Current Behavior

`Commanding.command` returns immediately with only the command name:

```ts
async command({ name, args }): Promise<{ name: string }> {
  return { name };
}
```

The `BuildCommand` sync reacts to that event and invokes several actions.
However, no action represents the build's final success or failure. The caller
of `Commanding.command` only waits for the synchronization engine to finish
processing the causal flow. It does not receive a semantic build result.

`main.ts` therefore does this unconditionally:

```ts
await Commanding.command(...);
console.log("Build complete.");
```

Every action in the pipeline can return `{ error: string }`, but almost all
`when` patterns use `{}` as the output pattern. An empty pattern matches both
successful and error outputs. No error synchronization converts those failures
into a failed command.

### Confirmed Reproduction: Missing Source

Running a build with a nonexistent source directory produced:

```text
Filing.scan ... => {
  error: "Directory does not exist: /tmp/.../missing"
}
Build complete.
```

The process exited with status `0` and wrote no files.

### Confirmed Reproduction: No Layouts

In a fresh process, running:

```bash
bun run src/main.ts build --source <pages> --output <out>
```

produced:

```text
Filing.scan { directory: "" ... } =>
  { error: "Directory does not exist: " }

Layouting.apply ... =>
  { error: "Layout not found: default" }

Build complete.
```

The process exited with status `0` and wrote no files.

### Why This Is a Concept-Design Problem

The purpose of a command boundary is not merely to echo that a command was
received. A caller needs to know whether the requested operation completed.

`Commanding` is incomplete because it has no lifecycle:

- no command identity;
- no accepted/rejected distinction;
- no success action;
- no failure action;
- no status query;
- no association between a result and the originating command.

The current principle also improperly describes behavior of the entire static
site application:

> after invoking a build command with source and output directories, the concept
> system processes the request through syncs to produce a static site

That principle cannot be fulfilled by `Commanding` alone. It therefore fails the
independence and purpose-focused rubric criteria.

### Minimal Fix

At minimum:

1. Change success-sensitive syncs to match explicit success outputs.
2. Add error syncs for `Filing.scan`, `Filing.read`, `Formatting.render`,
   `Layouting.apply`, `Filing.write`, and routing conflicts.
3. Add an application-level build failure action.
4. Make the CLI set a nonzero exit code when the build fails.
5. Print `Build complete.` only after an explicit build-success action.

This is still awkward if `Commanding` has no command identity.

### Recommended Fix

Redesign `Commanding` as a generic command lifecycle concept.

```concept
concept Commanding

purpose
  let a caller initiate an operation and determine whether it completed

principle
  after a caller issues a command, the command is assigned an identity;
  when processing succeeds the command becomes succeeded with a result, and
  when processing cannot complete it becomes failed with an explanation

state
  a set of Commands with
    a name String
    an arguments String
    a status of PENDING or SUCCEEDED or FAILED
    an optional result String
    an optional error String

actions
  issue (name: String, arguments: String): (command: Command)
  succeed (command: Command, result: String): (command: Command)
  fail (command: Command, error: String): (command: Command)

queries
  _get (command: Command): (name, status, result, error)
```

The arguments and result could use a project-wide JSON value type rather than
serialized strings if the engine's mapping types support it cleanly.

The build composition would bind the command identity through every terminal
sync:

```text
when Commanding.issue(name: "build") -> command
then Building.start(command, ...)

when Building.complete(build)
where build was initiated by command
then Commanding.succeed(command, ...)

when Building.fail(build, error)
where build was initiated by command
then Commanding.fail(command, error)
```

### Acceptance Criteria

- A missing source directory exits nonzero.
- A missing required layout exits nonzero.
- A failed write exits nonzero.
- The CLI never prints completion after a failed build.
- The command result identifies which build failed.
- Tests assert both output and process/result status.

---

## Finding 2: `ScanTriggersRead` Reads Entries From Unrelated Scans

**Severity:** High

**Primary files:**

- `src/syncs/app.ts`
- `src/concepts/Filing/FilingConcept.ts`

### Current Behavior

The synchronization is:

```ts
export const ScanTriggersRead: Sync = ({ entry, directory }) => ({
  when: actions([Filing.scan, { directory }, {}]),
  where: async (frames) => await frames.query(Filing._getAll, {}, { entry }),
  then: actions([Filing.read, { entry, directory }]),
});
```

The key problem is `_getAll`. It returns every entry ever discovered by the
`Filing` instance, not only entries created by the matched scan.

After a layout scan:

```text
Filing contains layout entries
```

After the content scan:

```text
Filing contains layout entries + content entries
```

`ScanTriggersRead` responds to the content scan by querying all entries, then
attempts to read every layout and content entry using the content directory.

### Confirmed Reproduction

A build with:

```text
layouts/default.html
pages/index.md
```

produced one spurious error:

```text
Failed to read file: .../pages/default.html
```

The real content page was still processed, so the test passed despite the
failure.

### Failure Interaction With Error Outputs

The scan's output pattern is `{}`. In this engine, that matches any output,
including:

```ts
{ error: "Directory does not exist: " }
```

If a failed scan occurs when entries already exist in `Filing`, the failed scan
can still trigger reads over those entries using the failed scan's directory.

This is exactly what happens in no-layout builds:

1. layout scan with `directory: ""` fails;
2. no entries exist yet, so its first `_getAll` query yields nothing;
3. content scan succeeds and adds entries;
4. the failed layout scan action was not consumed because its first match
   yielded no frames;
5. synchronization triggered by later actions can revisit journal evidence;
6. the failed layout scan now sees content entries and tries to read them from
   `directory: ""`.

The trace contains:

```text
Filing.read {
  entry: <content entry>,
  directory: "",
} => {
  error: "Failed to read file: index.md",
}
```

### Why This Is a Concept-Design Problem

The association between a scan and its discovered entries is real domain state.
It is not merely a temporary implementation detail.

The current `Filing` state loses that relationship:

```text
scan -> many entries
```

Instead it stores one global bag of entries and asks synchronization code to
reconstruct provenance using ad hoc labels and external directory arguments.

The state is therefore not sufficiently rich to support its actions and
queries. In particular:

- `read({ entry })` cannot determine where the entry came from;
- `_getAll()` cannot answer which entries a scan discovered;
- the caller must repeat the directory supplied during scan;
- scans cannot be independently inspected or retried;
- two scans of the same path cannot be distinguished cleanly.

### Minimal Fix

Change `scan` to return the entries it discovered:

```ts
scan(...): Promise<{ scan: ID; entries: ID[] } | { error: string }>
```

Then either:

- fire one read action per returned entry in a `where` transform; or
- add `_getEntries({ scan })`.

Also match explicit success:

```ts
when: actions([
  Filing.scan,
  { directory },
  { scan },
])
```

Do not use `{}` where success and failure must differ.

### Recommended Fix

Model scans explicitly.

```concept
concept Filing

state
  a set of Scans with
    a root String
    a patterns set of String
    a set of Entries

  a set of Entries with
    a scan Scan
    a relativePath String
    an extension String
    an optional content String

actions
  scan (root, patterns): (scan)
  read (entry): (entry, content)
  replaceContent (entry, content): (entry)

queries
  _getEntries (scan): (entry)
  _getEntry (entry): (relativePath, extension, content)
```

Because each entry stores its scan and each scan stores its root, `read` needs
only an entry identity.

### Acceptance Criteria

- A content scan never reads layout entries.
- A layout scan never reads content entries.
- A failed scan triggers no read actions.
- Two scans in one flow remain independently queryable.
- Tests inspect the action journal or results to prove that no spurious reads
  occurred.

---

## Finding 3: No-Layout Builds Work Only Through Leaked Test State

**Severity:** High

**Primary files:**

- `src/syncs/app.ts`
- `src/syncs/app.test.ts`
- `src/concepts/Layouting/LayoutingConcept.ts`

### Current Behavior

`main.ts` makes the layouts argument optional:

```ts
const layouts = getArg("--layouts") ?? "";
```

But `BuildCommand` always performs:

```ts
Filing.scan({
  directory: layouts,
  patterns: ["*.html"],
  ...
})
```

When `layouts === ""`, that scan returns an error.

Every content entry is nevertheless sent to:

```ts
Layouting.apply({
  layoutName: fields.layout ?? "default",
  ...
})
```

There is no built-in default layout, no pass-through branch, and no conditional
sync that skips layouting when layouts are absent.

### Why the Test Passes

`src/syncs/app.test.ts` imports singleton concepts:

```ts
import {
  Commanding,
  Engine,
  Filing,
  Layouting,
  ...
} from "@concepts";
```

Before each test, it clears only:

- `Filing`;
- `Collecting`;
- `Frontmattering`.

It does not clear:

- `Layouting`;
- `Formatting`;
- `Routing`;
- the engine action journal.

Earlier tests define a layout named `default`. Later tests titled
`builds without layouts directory` reuse that layout unintentionally.

In a fresh process, no such layout exists and the build writes nothing.

### Design Decision Required

There are two valid product semantics. The implementation must choose one
explicitly.

#### Option A: Layouts Are Required

Then:

- `--layouts` must be mandatory;
- the CLI must validate it;
- the build must fail if `default` is missing for a page that requests it;
- the documentation must not claim layouts are optional.

#### Option B: Layouts Are Optional

Then:

- the build must not scan an empty directory;
- pages without an applicable layout must use rendered HTML directly;
- layout application becomes conditional composition policy;
- a default layout may be explicitly built in or omitted.

Option B is probably more useful for a general static-site generator.

### Recommended Synchronization Shape

Do not make `Layouting` invent a default. Keep that application policy in syncs.

```text
when content is formatted
where the entry declares a layout
then Templating.render(...)

when content is formatted
where the entry declares no layout and no default is configured
then Publishing.stage(content: html)

when content is formatted
where a configured default template exists
then Templating.render(template: default)
```

### Acceptance Criteria

- The no-layout behavior is documented.
- Tests create a fresh `createConcepts()` instance per test.
- A fresh-process build without layouts produces the expected output or a clear
  nonzero failure, according to the chosen policy.
- No test depends on layouts created by previous tests.

---

## Finding 4: Route Collisions Silently Overwrite Pages

**Severity:** High

**Primary files:**

- `src/concepts/Routing/RoutingConcept.ts`
- `src/syncs/app.ts`
- `src/concepts/Routing/RoutingConcept.test.ts`

### Current Behavior

Both paths below derive `/about`:

```text
about.md
about/index.md
```

`Routing` stores each entry independently:

```ts
this.entries.set(entry, { _id: entry, filePath, route });
```

It does not enforce route uniqueness. `_getByRoute` explicitly permits multiple
entries.

`ApplyTriggersWrite` maps both entries to:

```text
about/index.html
```

The later write silently overwrites the earlier one.

### Confirmed Reproduction

A build containing both files produced two `/about` routes and one output file.
The final file contained the second page's content.

### Why This Belongs in Routing

If the purpose of `Routing` is to assign externally addressable routes to
entries, route uniqueness is an essential concept invariant for this
application class.

Without uniqueness, the concept does not provide a complete routing function;
it only computes candidate strings.

There are two possible concept designs:

#### Deriving Only

A `PathRouting` concept merely derives candidate routes and allows collisions.
A separate `Naming` or `Addressing` concept claims unique routes.

#### Managing Routes

`Routing` owns the entry-to-route relation and rejects collisions.

The current state and queries imply the second design, but the action behaves
like the first. This ambiguity should be resolved.

### Recommended Specification

```concept
concept Routing [Entry]

purpose
  assign stable, unambiguous public routes to entries

principle
  after a routing scheme is configured and an entry is assigned a path, the
  entry has one derived public route; assigning another entry that would use
  the same route is rejected

state
  a set of Schemes with
    a stripPrefix String
    an indexName String

  a set of RoutedEntries with
    an Entry
    a Scheme
    a filePath String
    a route String

actions
  createScheme (...): (scheme)
  assign (scheme, entry, filePath): (entry, route)
  remove (scheme, entry): (entry)

requires for assign
  no different entry in scheme already has route
```

### Additional Routing Problems

The current string-prefix behavior is also brittle:

- `stripPrefix: "pages/"` does not strip `pages/about.md` because an extra slash
  is added internally;
- route derivation uses platform path utilities and then normalizes slashes
  afterward;
- the singleton configuration is global to all builds;
- configuration changes do not rederive existing routes;
- no deletion action removes a route.

### Acceptance Criteria

- Route collisions return `{ error }`.
- The build fails rather than overwriting.
- Prefix normalization handles trailing separators.
- Route state is scoped to a scheme or build.
- Repeated derivation for one entry updates or rejects according to a documented
  rule.

---

## Finding 5: Output Is Not a Build Snapshot

**Severity:** High

**Primary files:**

- `src/concepts/Filing/FilingConcept.ts`
- `src/syncs/app.ts`

### Current Behavior

The build writes each page directly into the output directory. It never:

- removes files no longer generated;
- stages a complete output set;
- commits output atomically;
- records which build produced an artifact;
- rolls back a partially failed build.

### Confirmed Reproduction

1. Build with `old.md`.
2. Delete `old.md`.
3. Build again to the same output directory.

Result:

```text
out/old/index.html
```

remains present.

### User Impact

This causes stale pages to remain publicly accessible after deletion. More
subtle failures include:

- changed routing leaves the old route behind;
- renamed pages exist at both old and new routes;
- a failed build can update some pages while leaving others from a previous
  build;
- assets removed from source remain deployed;
- CI can report success even though output combines multiple source revisions.

### Why `Filing.write` Is Not Enough

Writing a file is a useful low-level concern. Publishing a site is a richer,
independent behavioral concept.

The purpose is not merely to perform writes. It is to make one coherent set of
artifacts visible as the current publication.

### Recommended Richer Concept: Publishing

```concept
concept Publishing [Artifact]

purpose
  make a coherent generated artifact set available as the current publication

principle
  after artifacts are staged for a publication and the publication is
  committed, exactly those artifacts become visible; if staging or commit
  fails, the previous publication remains intact

state
  a set of Publications with
    a destination String
    a status of STAGING or PUBLISHED or FAILED
    a set of Artifacts

  a set of Artifacts with
    a publication Publication
    a relativePath String
    a content String

actions
  begin (destination): (publication)
  stage (publication, relativePath, content): (artifact)
  commit (publication): (publication)
  fail (publication, error): (publication)

queries
  _getArtifacts (publication): (artifact, relativePath)
```

The implementation can use:

- a temporary sibling directory;
- complete staging;
- destination replacement or reconciliation;
- cleanup after failure.

### Minimal Fix

If a full `Publishing` concept is deferred:

1. Add an explicit build option to clean the output directory before writing.
2. Validate that output is not equal to or an ancestor of source.
3. Do not clean until source validation succeeds.
4. Fail the build if cleanup or any write fails.

This is less robust than staged publication because a mid-build failure leaves
partial output.

### Acceptance Criteria

- Removed source pages disappear after the next successful build.
- Failed builds do not claim success.
- Preferably, failed builds leave the prior successful output intact.
- The output directory cannot accidentally delete the source tree.

---

## Finding 6: `Collecting` Is Application-Specific and Incomplete

**Severity:** High

**Primary files:**

- `src/concepts/Collecting/CollectingConcept.ts`
- `src/syncs/app.ts`

### Current Purpose and Principle

The concept says:

> aggregate entry metadata by collection for index/list pages

Its principle mentions:

- frontmatter;
- an index page;
- collection membership;
- `{{#each posts}}`;
- excluding an index page from its own list.

This is a description of this application's composition, not an independent
concept.

### Conflated Concerns

`Collecting` currently combines:

1. category membership:

   ```text
   entry belongs to collection
   ```

2. a copied property bag:

   ```text
   entry has arbitrary metadata
   ```

3. index-generation coordination:

   ```text
   finalize triggers index regeneration
   ```

4. application conventions:

   ```text
   collection names come from frontmatter and feed template loops
   ```

These parts do not form one coherent reusable behavior.

### Incorrect Update Semantics

`collect` always unions collection names:

```ts
const mergedCols = [
  ...new Set([...(existing?.collections ?? []), ...collections]),
];
```

Suppose an entry was previously in `posts`, then its updated frontmatter removes
that membership:

```ts
collect({
  entry,
  collections: [],
  metadata: updated,
})
```

The entry remains in `posts`. There is no action to remove membership or replace
the collection set.

This violates lifecycle completeness.

### Metadata Duplication

Metadata is copied from `Frontmattering` into `Collecting`, then routing metadata
is merged in through a second action. This creates duplicated cross-concept
state:

```text
Frontmattering owns title/date/type/layout/collections
Routing owns route
Collecting owns copies of all of them
```

Global consistency now depends on multiple synchronizations firing in the right
order. Any update or failure can make `Collecting` stale.

### No-Op `finalize`

`finalize` changes no concept state:

```ts
async finalize(): Promise<Empty> {
  return {};
}
```

It exists only as an application-level semaphore. That is a strong indication
that the action does not belong in the concept.

Concept actions should express user-recognizable or system-recognizable behavior
of that concept. A no-op action whose only effect is “allow syncs to fire” is
coordination leakage.

### Recommended Replacement: Categorizing

```concept
concept Categorizing [Item]

purpose
  organize items into named groups so related items can be found together

principle
  after items are added to a category, querying the category returns those
  items; after an item is removed, it no longer appears

state
  a set of Categories with
    a name String

  a set of Memberships with
    an Item
    a Category

actions
  createCategory (name): (category)
  add (item, category): (item, category)
  remove (item, category): (item, category)
  replace (item, categories): (item)
  deleteCategory (category): (category)

queries
  _getItems (category): (item)
  _getCategories (item): (category)
```

The exact need for explicit category entities versus string category names
should be decided from product behavior. If categories have no independent
lifecycle, `Categorizing` can use strings while still supporting add/remove and
replacement.

### Where List Metadata Should Come From

When rendering a list:

1. query `Categorizing` for member identities;
2. query `Frontmattering` for each member's fields;
3. query `Routing` for each member's route;
4. aggregate those values into render data.

That is composition by synchronization. It avoids creating a shadow aggregate
database inside `Collecting`.

### Acceptance Criteria

- Removing a collection from frontmatter removes membership.
- Metadata has one authoritative owner.
- There is no no-op `finalize` action in a domain concept.
- The concept's purpose and principle make sense outside a static-site
  generator.

---

## Finding 7: Index Regeneration Is an Imperative Workflow in One Sync

**Severity:** High

**Primary file:**

- `src/syncs/app.ts`

### Current Responsibilities

`FinalizeTriggersIndexRegen` currently does all of the following:

1. queries every file;
2. determines which files are index pages using frontmatter field `type`;
3. queries rendered HTML;
4. parses `{{#each collection}}` syntax using a regular expression;
5. uses the parsed variable name as a collection name;
6. queries collection metadata;
7. filters out index entries using copied `type` metadata;
8. groups frames manually;
9. depends on `collectAs`'s output shape;
10. unwraps values using `Object.values(...)[0]`;
11. requeries frontmatter;
12. requeries rendered HTML;
13. constructs a template-variable object;
14. invokes layout application again;
15. indirectly writes the index page again.

This is too much semantic work for one synchronization.

### Fragile `collectAs` Unwrapping

The sync performs:

```ts
const flat = Object.values(item)[0];
```

This assumes:

- exactly one collected symbol;
- the collected record's first enumerable value is the metadata;
- `collectAs` continues to use string descriptions in its result;
- no other field is introduced.

The synchronization is coupled to an engine representation detail rather than
the declared query contract.

### Template Syntax Leakage

The sync parses:

```regex
\{\{#each\s+(\w+)\}\}
```

That syntax belongs to the template language implemented by `Layouting`.
Application synchronizations should not independently parse it.

Consequences:

- only the first loop is recognized;
- nested or multiple loops are unsupported;
- a loop variable is assumed to equal a collection name;
- syntax changes require edits in both concept and sync;
- malformed templates fail silently;
- an index page with no matching loop is simply skipped.

### Double Rendering and Double Writing

Index pages are first rendered and written during the normal page pipeline.
At that time their collection variable is missing, so the loop expands to
nothing.

After `finalize`, the same page is rendered and written again with collection
data.

This creates:

- unnecessary work;
- transient incomplete files;
- greater failure surface;
- unclear “when is a page ready?” semantics;
- dependence on a global batch barrier.

### Better Design Options

#### Option A: Template Declares Data Dependencies

The templating concept can expose a query:

```text
_getRequiredCollections(template): (name)
```

or a more general:

```text
_getVariables(template): (name, kind)
```

Then syncs can supply variables before the first render.

#### Option B: Frontmatter Declares Collection

An index page can explicitly declare:

```yaml
type: index
collection: posts
```

This is less magical and removes the need to inspect template syntax in a sync.
The template still uses `{{#each posts}}`, but the application composition has a
clear data dependency.

#### Option C: A Query/View Concept

For richer static sites, define a reusable concept for named data views:

```concept
concept Querying [Item]

purpose
  define reusable selections and orderings of items

state
  a set of Queries with
    a name String
    selection and ordering criteria

actions
  define (...)
  remove (...)

queries
  _evaluate (query): (item)
```

This becomes worthwhile when lists need filtering, sorting, limits, pagination,
or multiple source categories. It may be excessive for the current feature set.

### Recommended Near-Term Fix

Use explicit frontmatter:

```yaml
type: index
collection: posts
```

Then:

1. do not render index pages in the ordinary render sync;
2. after discovery and metadata parsing are complete, query category members;
3. enrich member identities from `Frontmattering` and `Routing`;
4. aggregate once;
5. render the index page once;
6. stage/write it once.

This still requires an explicit build-phase model, discussed later.

### Acceptance Criteria

- Synchronizations do not parse `{{#each}}`.
- Index pages are written once per build.
- Multiple lists can be modeled explicitly or rejected clearly.
- Empty collections render an empty list without dropping the index frame.
- Collection ordering has an explicit policy.

---

## Finding 8: `Filing` Conflates Discovery, Content Mutation, and Publication

**Severity:** High

**Primary file:**

- `src/concepts/Filing/FilingConcept.ts`

### Current State

Each entry stores:

```ts
{
  path,
  extension,
  content?,
  written,
  source
}
```

Global config stores:

```ts
{
  outputDirectory
}
```

### Concern 1: `source` Is Pipeline State

`source` is an arbitrary string used as:

```text
"layouts"
"content"
```

These labels exist so application syncs can distinguish two scans. They are not
intrinsic properties of files.

If kept, the field should represent a first-class scan or file-set identity,
not an unrestricted application label.

### Concern 2: Scan Configures Writing

`scan` accepts `outputDirectory` and stores it globally:

```ts
scan({
  directory,
  patterns,
  outputDirectory,
  source,
})
```

Discovering input files and configuring an output destination are independent
operations.

Symptoms of the conflation:

- scanning layouts overwrites output configuration;
- every later scan mutates the same singleton config;
- `write` depends on a prior `scan` even for externally created content;
- multiple builds cannot coexist safely in one concept instance;
- output behavior cannot be configured independently of input discovery.

### Concern 3: `read` Repeats Lost State

The scan root is not stored with each entry. Therefore:

```ts
read({ entry, directory })
```

requires the caller to supply a directory that must match the scan that created
the entry.

The concept cannot enforce that relationship because it did not retain it.
This is the direct cause of the cross-scan read bug.

### Concern 4: `setContent` Turns Input Entries Into Output Buffers

The page pipeline:

1. scans a source entry;
2. reads its original content;
3. replaces that content with rendered output;
4. writes it elsewhere.

After `setContent`, the concept has forgotten the original file content in the
entry record. The entry simultaneously represents:

- a source file;
- a parsed input;
- a rendered artifact;
- a written output.

This is object-centric aggregation rather than concern separation.

### Concern 5: Output State Is Inaccurate

`write({ outputRelativePath })` can write to a custom path, but `_getEntry`
computes:

```ts
path.join(outputDirectory, doc.path)
```

rather than returning the actual path used by the write.

A confirmed probe wrote:

```text
out/pretty/index.html
```

while `_getEntry` reported:

```text
out/a.md
```

The concept claims to store or expose output state that it does not actually
retain.

### Concern 6: Duplicate Discovery

If glob patterns overlap, the same physical file receives multiple fresh entry
identities.

For example:

```ts
patterns: ["*.md", "**/*.md"]
```

discovering `a.md` produced two entries.

The concept needs either:

- set semantics over `(scan, relativePath)`; or
- documentation that each match is an independent discovery occurrence.

The latter is unlikely to be desirable.

### Recommended Split

#### `Discovering [Resource]`

Purpose: identify resources under a root that match selection rules.

#### `Reading [Resource]`

Purpose: obtain content for resources.

#### `Publishing [Artifact]`

Purpose: commit generated artifacts as a coherent output set.

Splitting all three may be more abstraction than needed initially. A pragmatic
intermediate design is:

- keep discovery and reading together in `Filing`;
- move output staging and commit into `Publishing`;
- introduce explicit `Scan` state;
- preserve original input content;
- have generated artifact content belong to `Publishing`, not source entries.

### Acceptance Criteria

- `scan` does not configure output.
- `read` needs only an entry.
- overlapping patterns do not duplicate one path unintentionally.
- source content remains source content.
- generated output has its own artifact identity or publication state.
- queries report actual written/staged paths.

---

## Finding 9: `Layouting` Contains Multiple Rich Concepts

**Severity:** Medium to High

**Primary file:**

- `src/concepts/Layouting/LayoutingConcept.ts`

### Current Responsibilities

`Layouting` currently provides:

- named template registration;
- dependency extraction;
- component inclusion;
- recursive composition;
- circular-dependency detection;
- self-closing component syntax;
- wrapping component syntax;
- slot replacement;
- fallback slot content;
- scalar interpolation;
- collection iteration;
- rendered-entry storage.

This is a substantial template engine rather than one narrowly defined layout
association concept.

### Name and Purpose Mismatch

The word `Layouting` suggests assigning or applying layouts. The implementation
also defines a template language and a component module system.

More accurate concept names include:

- `Templating`;
- `Rendering`;
- `Composing`;
- `TemplateRendering`.

Naming matters because it helps expose whether the purpose is coherent.

### `compose` and `apply` Overlap

Both resolve the layout dependency graph:

```ts
compose -> #resolveLayout
apply   -> #resolveLayout
```

`compose` stores its output in `entries` using the layout name cast as an entry
identity:

```ts
const doc = this.entries.get(layoutName as Entry)
```

That conflates:

- a layout identity;
- an externally supplied entry identity.

It also indicates that the state model was shaped around implementation reuse
rather than abstract entities.

### External ID Type Confusion

The concept defines:

```ts
type Layout = ID;
type Entry = ID;
```

But `define` creates a layout identity by casting its human-readable name:

```ts
const layoutId = name as Layout;
```

This means names and identities are identical, while the state still models
them as if they were separate entities.

Choose one design:

1. layouts are identified by unique names, so use `name: string` consistently;
2. layouts have opaque IDs and a separate unique name relation, so allocate IDs.

### Empty Slot Content Bug

The renderer uses:

```ts
if (slotContent) return slotContent;
return fallback ?? "";
```

An explicitly supplied empty string is falsy, so:

```html
<slot>fallback</slot>
```

renders `fallback` rather than the intended empty content.

The check should be:

```ts
if (slotContent !== undefined)
```

### Regex-Based Markup Parsing

Component and loop structures are parsed with regular expressions. This is
acceptable for a deliberately small language if limitations are specified, but
the current documentation implies richer HTML-like structure.

Known limitations include:

- attributes on wrapping component tags are unsupported;
- component names are limited to `\w`;
- nested instances of the same wrapping component are not parsed structurally;
- malformed open/close pairs may be ignored;
- template syntax inside scripts or code blocks may be interpreted;
- loop variables only support flat string fields;
- HTML escaping is not performed;
- unknown variables silently become empty strings.

### Possible Concept Split

#### `Templating [Target]`

Owns templates, partial dependencies, slots, variables, loops, and rendering.

#### `LayoutAssigning [Target, Template]`

Owns the relation:

```text
target uses template
```

This second concept is useful only if layout selection has a lifecycle or is
shared independently of frontmatter. For the current application, the selected
layout can remain a frontmatter field and be passed through syncs.

Therefore the pragmatic recommendation is one richer `Templating` concept, not
two concepts immediately.

### Recommended Specification

```concept
concept Templating [Target]

purpose
  produce documents consistently from reusable templates and supplied data

principle
  after a base template and a template that includes it are defined, rendering
  a target with the outer template and data produces one document with all
  partials, slots, variables, and repeated values resolved

state
  a set of Templates with
    a unique name String
    a source String
    a uses set of Templates

  a set of Renderings with
    a Target
    a Template
    a document String

actions
  define (name, source): (template)
  update (template, source): (template)
  remove (template): (template)
  render (target, template, data): (target, document)

queries
  _getTemplate (template): (...)
  _getRendering (target): (document)
  _getRequirements (template): (...)
```

### Acceptance Criteria

- Layout/template identities are modeled consistently.
- Empty slot content remains empty.
- Updating and deleting templates are explicit.
- Syntax limitations and escaping semantics are documented.
- Synchronizations no longer parse template syntax independently.

---

## Finding 10: `Formatting [Entry]` Allocates External Identities

**Severity:** Medium

**Primary file:**

- `src/concepts/Formatting/FormattingConcept.ts`

### Current Behavior

`render` accepts:

```ts
entry?: ID
```

and generates a fresh ID if omitted:

```ts
const id = entry ?? freshID();
```

### Why This Is Ambiguous

If `Entry` is a generic type parameter allocated by another concept, Formatting
must treat it polymorphically and must not allocate one.

If the concept allocates the identity, it is not an external `Entry`; it is an
internal `Rendering` or `FormattedDocument`.

The current API attempts to support both models simultaneously.

### Two Valid Designs

#### Design A: Formatting Associates Output With External Targets

```concept
concept Formatting [Target]

render (target, source, format): (target, output)
```

`target` is required. The concept never allocates one.

This fits the current synchronization pipeline best.

#### Design B: Formatting Creates Rendering Entities

```concept
concept Formatting

render (source, format): (rendering, output)
```

The concept allocates `rendering`. A separate sync associates it with an entry.

This is more explicit but adds an identity that may not provide value.

### Other Lifecycle Gaps

Formatting stores every result indefinitely but has no:

- remove action;
- clear action;
- explicit update semantics;
- query by format;
- distinction between rendering versions.

Because the static-site tool is in-memory, indefinite storage lasts only one
process, but repeated builds in one process still retain stale entries.

### Recommended Fix

Use Design A:

```ts
render({
  target,
  source,
  format,
})
```

Require the target and add:

```text
remove(target)
clear()
```

or scope rendering state to a build identity so explicit global clearing is not
needed.

### Acceptance Criteria

- The concept does not allocate external generic IDs.
- Re-rendering one target has documented replacement semantics.
- State can be removed or scoped to a build.

---

## Finding 11: Frontmatter Claims YAML Semantics Without Providing Them

**Severity:** Medium

**Primary file:**

- `src/concepts/Frontmattering/FrontmatteringConcept.ts`

### Current Behavior

The concept recognizes frontmatter only when raw content begins exactly with:

```text
---\n
```

It then uses a custom line parser that supports only:

- unquoted strings;
- simply quoted strings;
- numbers;
- booleans;
- one `key: value` per line.

### Confirmed Limitations

#### CRLF Input

Content beginning with:

```text
---\r\n
```

is treated as having no frontmatter. The complete document remains in the body.

#### Arrays

```yaml
tags:
  - one
  - two
```

becomes:

```ts
{ tags: "" }
```

#### Nested Values

Objects and nested mappings are not represented.

#### Comments and Escaping

Only full-line comments are skipped. YAML quoting, escapes, multiline strings,
nulls, dates, inline arrays, and inline objects do not behave as YAML.

#### Malformed Fences

An opening fence with no closing fence silently makes the whole document the
body rather than returning an error.

### Why This Matters for Concept Design

A concept's actions should have clear preconditions and effects. Calling the
format “YAML” creates a behavioral contract that the implementation does not
meet.

There are two legitimate choices:

1. support actual YAML using a mature parser;
2. define a deliberately restricted metadata syntax and name/document it
   accordingly.

### Recommended Fix

Use a YAML parser dependency if frontmatter is intended to be compatible with
common static-site conventions.

The parsed value type should not be:

```ts
Record<string, string | number | boolean>
```

It should use a recursive JSON-compatible type:

```ts
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
```

Then:

```ts
Record<string, JsonValue>
```

The template and collection-data types must also be updated if arrays and nested
objects are supported.

### Specification Improvements

Add a full concept header:

```concept
concept Frontmattering [Document]

purpose
  let metadata travel with a textual document while remaining independently
  accessible from its body

principle
  after parsing a document with a fenced metadata header, the metadata fields
  and clean body can be retrieved separately
```

Define malformed-input behavior explicitly.

### Acceptance Criteria

- CRLF frontmatter works.
- Supported syntax is documented truthfully.
- Malformed metadata returns `{ error }`.
- Nested and list values either work or are explicitly rejected.
- Tests cover delimiters, quoting, comments, lists, nesting, and malformed
  documents.

---

## Finding 12: Synchronization Correlation and Sequencing Are Fragile

**Severity:** Medium to High

**Primary files:**

- `src/syncs/app.ts`
- `src/engine/sync.ts`

### Missing Entry Correlation

The render-and-route join uses:

```ts
when: actions(
  [Formatting.render, {}, { entry }],
  [Routing.derive, {}, {}],
)
```

The second action is not constrained to the same `entry`.

Within the current flow, there is normally one content entry because each
`Filing.read` starts a nested causal chain. That makes the sync appear safe.
However, the declaration does not state the intended invariant.

It should bind:

```ts
[Routing.derive, { entry }, { entry, route }]
```

or at least:

```ts
[Routing.derive, { entry }, {}]
```

Good synchronization declarations should encode their logical relationship
directly rather than relying on incidental flow shape.

### Ordered `then` as a Workflow Script

`BuildCommand` invokes:

```text
clear
clear
clear
configure
scan layouts
scan content
finalize
```

The engine awaits `then` actions sequentially, and each action's downstream
syncs finish before the next action starts. Therefore this works like an
imperative script.

While ordered actions are supported, the sync is expressing an entire workflow
rather than one causal rule. Its correctness depends on:

- action ordering;
- nested synchronization completion;
- mutable singleton state;
- a final no-op action;
- no error abort semantics.

### No Explicit Batch or Phase State

The build has real phases:

```text
initializing
discovering templates
discovering content
parsing metadata
resolving references
rendering
publishing
complete/failed
```

None are represented in concept state. `Collecting.finalize` stands in for
“content discovery and metadata collection are now complete.”

This means:

- the build cannot report progress;
- the build cannot know how many entries remain;
- failed entries do not prevent finalization;
- future concurrency would break implicit ordering;
- incremental builds cannot reuse the same model cleanly.

### Recommended Richer Concept: Building

```concept
concept Building [Input, Artifact]

purpose
  coordinate production of a complete artifact set from a finite set of inputs
  and expose whether the production run completed

principle
  after a build starts and its inputs are registered, each input is processed;
  when all required artifacts are ready the build completes, but if any required
  processing fails the build fails

state
  a set of Builds with
    a status of PENDING or RUNNING or SUCCEEDED or FAILED
    an expected set of Inputs
    a completed set of Inputs
    a set of Artifacts
    an optional error String

actions
  start (...): (build)
  registerInput (build, input): (build, input)
  completeInput (build, input): (build, input)
  addArtifact (build, artifact): (build, artifact)
  fail (build, error): (build)
  complete (build): (build)

queries
  _getPendingInputs (build): (input)
  _getStatus (build): (...)
```

This concept should remain generic. It does not need to know about Markdown,
layouts, or routes.

### Acceptance Criteria

- Multi-action joins bind all shared identities explicitly.
- Build completion is represented by state, not a no-op semaphore.
- An entry failure prevents successful completion.
- Final publication occurs only after all required artifacts are ready.

---

## Finding 13: Tests Are Not Isolated and Some Assertions Are Vacuous

**Severity:** High for confidence, Medium for product behavior

**Primary files:**

- `src/syncs/app.test.ts`
- concept test files

### Global Singleton Use

The sync tests import singleton concepts and register syncs once at module load.
State persists between tests unless explicitly cleared.

Only three concepts are cleared in `beforeEach`, and even those require unsafe
casts because empty-input actions are invoked without the expected proxy shape.

This permits:

- layouts from earlier tests to persist;
- routing configuration to persist;
- formatting results to persist;
- action journal records to accumulate;
- test order to influence behavior.

### No Engine Reset

The action journal is append-only. Tests share one `Engine`, so completed flows
remain in memory. Flow IDs prevent most cross-flow matches, but the test
environment still differs from a fresh application and consumes unbounded
memory.

### Vacuous Route Test

The test named:

```text
RouteTriggersUpdateIndex collects route metadata
```

queries:

```ts
Collecting._getEntries({ collection: "posts" })
```

after collecting route metadata with no collection membership, then only
asserts:

```ts
expect(entries).toBeDefined();
```

An empty array satisfies that assertion. The test does not verify the behavior
in its name.

### Green Tests Contain Logged Errors

Several passing tests emit:

```text
Layouting.apply => { error: "Layout not found: default" }
```

They pass because they assert an earlier intermediate state, not the terminal
pipeline behavior.

High line coverage includes lines that executed unsuccessfully. Coverage is not
evidence that the intended effects occurred.

### Missing Behavioral Tests

The suite needs explicit cases for:

- missing source directory;
- missing layouts directory in a fresh app;
- missing requested layout;
- scan error does not trigger reads;
- layout entries are not reread by content scans;
- route collision;
- stale output removal;
- write failure;
- malformed frontmatter;
- CRLF frontmatter;
- empty collection index;
- collection membership removal;
- multiple index/list requirements;
- empty slot content;
- overlapping glob patterns;
- no state leakage between truly isolated builds.

### Recommended Test Architecture

Each test should create:

```ts
const app = createConcepts();
app.Engine.register(createSyncs(app));
```

The current sync module closes over global singleton concepts, so a factory may
be needed:

```ts
export function createSyncs(concepts: AppConcepts) {
  const { Filing, Routing, ... } = concepts;
  return { ... };
}
```

Alternatively, keep app sync declarations bound to one app instance but provide
`setupApp()` that creates a fresh isolated module graph or dependency-injected
composition.

### Test Assertion Standard

Each integration test should assert:

1. the initiating result;
2. the terminal build status;
3. expected output files;
4. expected output content;
5. absence of unexpected output;
6. absence of error actions for successful builds.

### Acceptance Criteria

- Tests can run in any order.
- A single test run and isolated test run have identical results.
- The no-layout test passes in a fresh process for the intended reason.
- No passing success-path test logs ignored errors.

---

## Additional Design and Implementation Findings

### A. Concept Specifications Are Mostly Embedded Comments

The requested feature process says to write concept specifications before
implementation. The current concepts have partial headers, but several omit:

- explicit type parameters;
- abstract state in SSF form;
- complete action lists;
- complete query lists;
- requires/effects for queries;
- lifecycle decisions.

Create one specification document per concept or a consolidated design document
before major refactoring.

### B. Clear Actions Are Used as Global Reset Plumbing

`Filing.clear`, `Collecting.clear`, and `Frontmattering.clear` are invoked before
each build. `Formatting`, `Routing`, and `Layouting` are not cleared.

Global clearing is a weak substitute for run scoping. Prefer associating
transient state with a `Build` identity:

```text
parsed document belongs to build
route assignment belongs to scheme/build
rendering belongs to build
publication belongs to build
```

Then old runs can be discarded coherently.

### C. Layout State Leaks Across Builds

Because `Layouting` has no clear/remove lifecycle in the pipeline:

- a layout deleted from the layouts directory remains available;
- a second build without layouts can use layouts from the first;
- a renamed layout leaves the old name present.

This is both a correctness bug and an incomplete template lifecycle.

### D. Routing State Leaks Across Builds

Routing entries are never cleared. Fresh entry IDs reduce direct collisions, but
old mappings remain queryable and consume memory. `_getByRoute` may return stale
entries from prior builds.

### E. Formatting State Leaks Across Builds

Formatted content is never cleared. It is keyed by fresh filing entry IDs, so
old results persist.

### F. Collection Ordering Is Undefined

`Collecting._getEntries` returns `Map` insertion order. Blog post order therefore
depends on filesystem/glob discovery order, which is not a meaningful user
policy.

A listing feature usually needs explicit ordering:

- date descending;
- title ascending;
- configured weight;
- source order.

This is another signal that richer list/query behavior may deserve a concept.

### G. User Metadata Is Converted to Strings Prematurely

The sync converts every frontmatter value with:

```ts
String(value)
```

This loses:

- numeric ordering semantics;
- booleans;
- arrays;
- nested objects;
- null;
- date typing.

The template-data model should use a recursive structured value type.

### H. HTML Trust and Escaping Are Undefined

Markdown output and template variables are inserted directly into HTML.

Questions requiring explicit policy:

- Is source content trusted?
- Are scalar variables HTML escaped?
- Can frontmatter inject HTML?
- Should raw HTML in Markdown be allowed?
- Is `sanitize-html` intended to be used? It is currently a dependency but is
  not used by the new concepts.

This is not necessarily a vulnerability for a local trusted-source SSG, but the
trust model must be documented.

### I. Package and Repository Documentation Are Stale

`README.md`, `package.json`, `.env.template`, deployment files, and the supplied
root architecture summary still describe:

- MongoDB;
- authentication;
- profiles;
- roles;
- Requesting HTTP server;
- frontend and SDK directories that are deleted.

This makes the repository misleading and will cause future implementation work
to follow obsolete assumptions.

The static-site generator deliberately uses in-memory state, which conflicts
with the current top-level instructions saying the application runs on MongoDB.
That architectural exception should be documented explicitly and consistently.

### J. Synchronization File Organization Does Not Follow the Stated Pattern

All eleven syncs live in `src/syncs/app.ts`, despite the repository convention
that feature syncs use `.sync.ts` files and `app.ts` is composition.

Recommended organization:

```text
src/syncs/
  app.ts
  build.sync.ts
  discovery.sync.ts
  content.sync.ts
  templates.sync.ts
  routing.sync.ts
  publishing.sync.ts
  errors.sync.ts
```

The exact split should follow behavioral rules, not one file per action.

---

## Recommended Target Concept Model

The following is a pragmatic target. It introduces richer concepts only where
they remove real coordination complexity.

### 1. `Commanding`

Generic external boundary with command identity and result lifecycle.

Owns:

- command name;
- arguments;
- pending/succeeded/failed status;
- result or error.

Does not know:

- build arguments;
- source directories;
- layouts;
- static sites.

### 2. `Building [Input, Artifact]`

Tracks one finite production run.

Owns:

- build identity;
- status;
- expected inputs;
- completed inputs;
- produced artifacts;
- failure.

Does not know:

- Markdown;
- filesystem paths;
- template syntax;
- category names.

This concept replaces `Collecting.finalize` as the completion mechanism.

### 3. `Filing`

Discovers and reads filesystem inputs.

Owns:

- scan identities;
- roots and patterns;
- discovered entry identities;
- relative paths;
- input content.

Does not own:

- output directory;
- rendered content;
- publication status;
- `"layout"` and `"content"` pipeline labels.

If the application needs scan roles, those can be represented in composition:

```text
build has template scan
build has content scan
```

or as separate `Building` input classes.

### 4. `Frontmattering [Document]`

Separates metadata and body from documents.

Owns:

- raw content;
- structured metadata;
- body;
- parse errors.

Uses actual YAML or an explicitly restricted format.

### 5. `Formatting [Target]`

Transforms source text according to a named format.

Owns:

- target-to-source relation if preservation is required;
- selected format;
- output.

Requires the external target identity.

### 6. `Routing [Entry]`

Assigns unambiguous public routes under a routing scheme.

Owns:

- schemes/configuration;
- entry/path/route associations;
- uniqueness invariant;
- route removal.

### 7. `Categorizing [Item]`

Owns category membership only.

Supports:

- add;
- remove;
- replace;
- query members;
- query categories.

Does not copy metadata.

### 8. `Templating [Target]`

Defines reusable templates and renders targets using structured data.

Owns:

- template definitions;
- partial dependencies;
- template validation;
- render results;
- syntax requirements if needed.

### 9. `Publishing [Artifact]`

Stages and commits a coherent output snapshot.

Owns:

- destination;
- artifact path/content;
- publication state;
- commit/failure;
- stale artifact removal or atomic replacement.

---

## Recommended Target Synchronization Flow

The exact API depends on final concept specs, but the desired causal structure
is approximately:

### Start

```text
when
  Commanding.issue(name: "build", arguments): command
then
  Building.start(command, ...): build
```

### Discover Templates

```text
when
  Building.start(build, layoutsRoot exists)
then
  Filing.scan(root: layoutsRoot, patterns): templateScan
```

```text
when
  Filing.scan(...): templateScan
where
  entries belong to templateScan
then
  Filing.read(entry)
```

```text
when
  Filing.read(templateEntry): content
then
  Templating.define(name derived by application policy, source: content)
  Building.completeInput(build, templateEntry)
```

If layouts are optional, absence of a layouts root is not an error and no scan
is issued.

### Discover Content

```text
when
  Building.start(build)
then
  Filing.scan(root: sourceRoot, patterns): contentScan
```

Each scan success explicitly registers its entries as build inputs.

### Parse and Enrich

```text
when
  Filing.read(contentEntry): raw
then
  Frontmattering.parse(document: contentEntry, raw)
```

```text
when
  Frontmattering.parse(document): success
then
  Formatting.render(target: document, source: body, format)
  Routing.assign(scheme, entry: document, filePath)
  Categorizing.replace(item: document, categories from metadata)
```

The category replacement should occur from one authoritative metadata result,
not through cumulative merging.

### Render Ordinary Pages

```text
when
  Formatting.render(target): html
  Routing.assign(entry: target): route
where
  target is not a list/index page
  metadata and selected template are available
then
  Templating.render(target, template, data)
```

If no template applies:

```text
then Publishing.stage(publication, routePath, html)
```

### Render List Pages

```text
when
  Building has completed metadata/routing for all content inputs
where
  page declares category C
  members are found through Categorizing
  each member is enriched from Frontmattering and Routing
then
  Templating.render(page, template, data including members)
```

This is the only place a build-phase completion condition is needed. It should
come from `Building`, not a no-op action on `Collecting`.

### Stage Artifacts

```text
when
  Templating.render(target): document
  Routing.assign(entry: target): route
then
  Publishing.stage(publication, outputPath(route), document)
  Building.addArtifact(build, artifact)
  Building.completeInput(build, target)
```

### Publish and Finish

```text
when
  Building is ready to complete
then
  Publishing.commit(publication)
```

```text
when
  Publishing.commit(publication): success
then
  Building.complete(build)
  Commanding.succeed(command, result)
```

### Failure

Every normal failure should have a synchronization:

```text
when
  Filing.scan(...): error
where
  scan belongs to build
then
  Building.fail(build, error)
```

Equivalent rules apply to reading, frontmatter parsing, formatting, routing,
templating, staging, and committing.

Once a build is failed, later syncs should either be filtered out by status or
their actions should reject because the build/publication is no longer active.

---

## Staged Remediation Plan

The changes should be made in phases. Attempting the full target model in one
patch would create unnecessary risk.

## Phase 0: Capture Current Behavior

Before changing architecture:

1. Add fresh-process or isolated-app tests for every confirmed defect.
2. Make those tests fail for the expected reason.
3. Turn engine logging off by default in tests unless a test asserts traces.

Required regression tests:

- missing source fails;
- no layouts has defined behavior;
- no cross-scan reads;
- route collision fails;
- stale output is removed or explicitly documented;
- passing builds contain no ignored action errors.

## Phase 1: Correct Immediate Runtime Failures

### Tasks

1. Skip layout scanning when no layouts directory is supplied.
2. Decide and implement no-layout rendering behavior.
3. Make `ScanTriggersRead` use entries from the successful matched scan only.
4. Match success output fields rather than `{}`.
5. Add route collision rejection.
6. Propagate failures to the CLI.
7. Bind `entry` explicitly in every multi-action join.

### Goal

Make existing concepts behave honestly before deeper redesign.

## Phase 2: Isolate Tests and App Instances

### Tasks

1. Stop importing singleton concepts in integration tests.
2. Introduce a sync factory or isolated app setup helper.
3. Create a fresh engine and concept instances for every test.
4. Remove unsafe action invocation casts.
5. Assert terminal outcomes rather than only intermediate state.

### Goal

Ensure the test suite can detect subsequent design regressions.

## Phase 3: Repair Concept Lifecycles

### Tasks

1. Give `Filing` explicit scan identities and roots.
2. Make `read` take only `entry`.
3. Add update/remove/reset semantics to Routing, Formatting, and Templating.
4. Replace cumulative collection union with explicit category replacement.
5. Remove copied metadata from the categorization concern.
6. model template deletion or scope templates to a build.

### Goal

Eliminate global-state workarounds and stale in-memory state.

## Phase 4: Introduce Build Lifecycle

### Tasks

1. Specify and implement `Building`.
2. Associate discovered inputs with a build.
3. Track completion and failures.
4. Remove `Collecting.finalize`.
5. Delay list rendering until required input enrichment is complete.
6. Make command completion derive from build completion.

### Goal

Replace procedural sequencing and no-op barriers with explicit state.

## Phase 5: Introduce Publication Snapshot

### Tasks

1. Specify and implement `Publishing`.
2. Stage all output artifacts.
3. Detect duplicate output paths before commit.
4. Commit as a coherent snapshot.
5. Remove stale files.
6. Preserve the previous successful output on failure where practical.

### Goal

Make build output complete, deterministic, and safe.

## Phase 6: Refine Template and Metadata Models

### Tasks

1. Rename/refocus `Layouting` to `Templating`.
2. Choose a precise supported template grammar.
3. Expose template data requirements if needed.
4. Replace custom pseudo-YAML with a real parser or rename the syntax.
5. Introduce recursive structured data types.
6. Define HTML escaping/trust behavior.

### Goal

Remove syntax parsing from syncs and make the user-facing content model robust.

## Phase 7: Documentation and Repository Cleanup

### Tasks

1. Rewrite `README.md` for the static-site generator.
2. Update `package.json` description.
3. Remove or revise obsolete MongoDB environment instructions.
4. Review unused dependencies.
5. Review obsolete deployment files.
6. Split syncs into `.sync.ts` modules.
7. Add written concept specifications.

---

## Detailed Verification Matrix

### Command and Build Lifecycle

- valid build becomes succeeded;
- invalid source becomes failed;
- invalid layout scan becomes failed when layouts are required;
- malformed content becomes failed;
- route conflict becomes failed;
- write/publication failure becomes failed;
- exactly one terminal result exists per command;
- CLI exit status matches terminal result.

### Filing and Discovery

- one scan returns only its own entries;
- overlapping patterns deduplicate by relative path;
- reads use the scan root stored in state;
- deleted files are absent from the next scan;
- scan roots can coexist;
- errors do not trigger reads.

### Frontmatter

- LF and CRLF delimiters;
- no frontmatter;
- empty frontmatter;
- quoted strings;
- numbers;
- booleans;
- null;
- arrays;
- nested objects;
- malformed YAML;
- missing closing fence;
- body beginning with `---` but not a valid header.

### Formatting

- Markdown;
- HTML pass-through;
- unsupported format;
- required external target;
- rerender replacement;
- state removal or build scoping.

### Routing

- top-level page;
- nested page;
- index page;
- configurable index name;
- prefix with and without trailing separator;
- Windows-style and POSIX paths as applicable;
- duplicate route rejection;
- route removal;
- multiple schemes/builds.

### Categorizing

- add membership;
- duplicate add is idempotent or rejected consistently;
- remove membership;
- replace all memberships;
- query by category;
- query categories by item;
- empty category;
- deleted category behavior.

### Templating

- scalar interpolation;
- missing variable policy;
- escaping policy;
- partial inclusion;
- wrapping partial;
- circular dependency;
- missing dependency;
- empty slot content;
- fallback slot content;
- empty loop;
- multiple loops;
- nested loops if supported;
- update and delete template.

### Publishing

- stage artifact;
- duplicate output path rejection;
- successful commit;
- stale artifact removal;
- commit failure;
- previous snapshot preservation;
- path traversal rejection;
- source/output overlap rejection.

### Integration

- simple Markdown site without layouts;
- site with default layout;
- site with nested templates;
- HTML pass-through;
- list page with zero items;
- list page with multiple items and deterministic ordering;
- two sequential isolated builds;
- source deletion removes output;
- route rename removes old output;
- one bad page fails the whole build according to policy;
- no passing build contains ignored error actions.

---

## Priority Summary

### Fix Before Treating the Tool as Reliable

1. Honest failure propagation and exit status.
2. Correct scan-to-entry correlation.
3. Explicit no-layout behavior.
4. Route collision detection.
5. Isolated integration tests.

### Fix Before Expanding Features

1. Replace `Collecting` with a coherent category concern.
2. Introduce explicit build completion state.
3. Stop parsing template syntax in synchronization code.
4. Separate publication from source-file state.
5. Scope or clean all transient state.

### Fix Before Claiming Broad Format Compatibility

1. Real YAML or accurately documented restricted syntax.
2. Defined template grammar.
3. Structured data values.
4. Defined escaping and trust model.

---

## Final Assessment

The current implementation proves that the synchronization engine can compose a
working static-site pipeline, but it is not yet a strong example of concept
design.

The primary issue is not that concepts import one another; they do not. The
deeper issue is that several concepts are semantically coupled through copied
state, application-specific labels, implicit singleton configuration, and
sync-only semaphore actions.

The most important design improvement is to model the entities that already
exist implicitly:

- a command with a result;
- a build with inputs and status;
- a scan with discovered entries;
- category membership;
- a rendering;
- a publication with a complete artifact set.

Once those relationships are explicit, the synchronizations become smaller and
more declarative:

- successful discovery causes reading;
- parsed metadata causes categorization and formatting;
- completed enrichment causes rendering;
- completed renderings cause artifact staging;
- a complete build causes publication;
- publication success causes command success;
- any normal failure causes build and command failure.

That structure aligns much more closely with the repository's design rules:
independent concepts, complete behavioral lifecycles, rich enough state,
polymorphic identities, and composition by clear causal synchronizations.
