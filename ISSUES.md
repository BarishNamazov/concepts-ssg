# Issues & Improvements

Code review focus: brittle/flaky logic and concept independence. Concepts do not directly import each other, but several concept implementations still carry app/template concerns that make them less reusable and harder to reason about independently.

Issues are grouped by the layer they affect — concept design, sync composition, engine core, filesystem safety, or parsing — rather than by severity.

## Concept Design

Issues where concepts carry application-specific concerns, conflate identity spaces, or use global mutable state.

### ISS-012: Watching knows too much about filesystem/runtime and can emit stale polls

Evidence: `src/concepts/Watching/WatchingConcept.ts:24-31`, `src/concepts/Watching/WatchingConcept.ts:61-77`, `src/concepts/Watching/WatchingConcept.ts:136-169`, `src/concepts/Watching/WatchingConcept.ts:185-227`, `src/runtime/filesystem_watch_driver.ts:20-31`

`Watching` is nominally generic over `Subject`, but it casts subjects to strings for a filesystem driver and stores a `pollEmitter` callback into the sync engine. Timer callbacks do not re-check active status before emitting, and `poll` accepts stopped watchers. The filesystem driver does not catch `watch()` setup failures or watcher error events.

Impact: stopped watchers can still trigger rebuilds, platform-specific watch failures can bypass structured error syncs, and concept independence is weakened by runtime/event-engine knowledge.

Suggested fix: move driver subscription and engine emission to a runtime adapter, keep `Watching` as snapshot comparison state, guard `poll` by active status, and have the driver return structured startup/runtime errors.

### ISS-013: Global mutable state causes cross-instance and cross-build interference

Evidence: `src/concepts/Serving/ServingConcept.ts:14-15`, `src/concepts/Serving/ServingConcept.ts:147-170`, `src/concepts/Filing/FilingConcept.ts:33-34`, `src/concepts/Filing/FilingConcept.ts:99`, `src/concepts/Filing/FilingConcept.ts:253-256`, `src/concepts/CommandLine/CommandLineConcept.ts:112-115`, `src/concepts/CommandLine/CommandLineConcept.ts:166-200`

`Serving` stores SSE clients in a module-level map shared by all instances and servers. `Filing` has one mutable output directory for all entries, and `_getEntry` recomputes output paths from current config rather than the stored write target. `CommandLine` mutates `console` and `process.exitCode` inside concept actions.

Impact: stopping one server disconnects all clients, rebuilds can write entries using another build's output config, and tests/runtime invocations become order-dependent through global process state.

Suggested fix: scope `Serving` clients by concept instance and server ID, store per-entry/per-build output paths, and move console/process effects to a CLI runtime adapter sync.

### ISS-016: Layouting conflates layout names, layout IDs, and entry IDs

Evidence: `src/concepts/Layouting/LayoutingConcept.ts:33-57`, `src/concepts/Layouting/LayoutingConcept.ts:60-75`, `src/concepts/Layouting/LayoutingConcept.ts:78-120`

`define` uses `name as Layout`, while `compose` stores composed layouts in the same `entries` map using `layoutName as Entry`. That assumes human names are stable IDs and that layout and entry ID spaces never collide.

Impact: layout names can overwrite or collide with entry state, and the concept depends on app naming conventions instead of concept-owned identities.

Suggested fix: allocate fresh layout IDs and store `name` as a unique field. Keep layout-composition state separate from entry-application state.

### ISS-017: Routing derives routes from mutable global config and weak normalization

Evidence: `src/concepts/Routing/RoutingConcept.ts:28-39`, `src/concepts/Routing/RoutingConcept.ts:54-95`

`Routing.configure` mutates global config while existing routes remain in state. Prefix stripping is raw string matching, and path normalization happens after route derivation.

Impact: reconfiguring between builds leaves stale route assignments, and `./`, `..`, backslash, or prefix-boundary edge cases can produce unexpected routes or collisions.

Suggested fix: make config immutable per route set/build, clear or rederive existing routes on config change, and normalize/reject paths before prefix stripping.

### ISS-005: Publishing commit is destructive and non-atomic

Evidence: `src/concepts/Publishing/PublishingConcept.ts:131-152`

`Publishing.commit` removes stale files before all staged artifacts are written. If a later write fails, the destination has already been mutated and the publication remains in `STAGING`. Concurrent commits to the same destination can interleave.

Impact: partial/corrupt publications and stale status after an I/O failure.

Suggested fix: write to a temporary directory, validate all artifacts, then atomically swap or promote the complete result. Add a per-destination lock and mark the publication `FAILED` on commit errors.

## Sync Layer

Issues in how syncs compose concepts — stage gating, failure propagation, ordering dependencies, and dev orchestration.

### ISS-002: Build can report success and clean output after failures

Evidence: `src/syncs/build.sync.ts:59-98`, `src/syncs/errors.sync.ts:16-29`, `src/syncs/pipeline-errors.sync.ts:32-58`

The build sync issues `Building.complete`, `Filing.cleanOutput`, and `Commanding.succeed` in the same `then` list as scans. Sync `then` actions do not short-circuit on `{ error }`, so scan/read/render/write/route failures can still be followed by destructive cleanup and command success. Several later error syncs attempt `Commanding.fail`, but they can race with or lose to `Commanding.succeed`.

Impact: failed builds can appear successful, output cleanup can run after incomplete writes, and CLI status can become misleading.

Suggested fix: model build stages explicitly. Complete and succeed only after querying that the command/build is still running and all required operations succeeded. Treat cleanup as command-scoped and fail the command on cleanup error before any success action.

### ISS-007: Dev startup can partially start resources and leave CLI pending

Evidence: `src/syncs/dev.sync.ts:21-37`, `src/syncs/dev.sync.ts:133-162`, `src/syncs/cli.sync.ts:123-129`

`DevStart` starts the server, starts the watcher, and issues the initial build in one `then` list. If server or watcher startup returns `{ error }`, later actions still run. There is a `WaitForReadySucceed` sync but no corresponding `WaitForReadyFail`, so dev startup failures can fail `Commanding` without failing the `CommandLine` invocation.

Impact: leaked watchers/servers, partially started dev environments, and invocations that stay pending or exit with the wrong status.

Suggested fix: chain startup stages with success-only syncs, add `WaitForReadyFail`, and cleanup already-started resources on later startup failure.

### ISS-008: Dev rebuilds can overlap and corrupt global build state

Evidence: `src/syncs/dev.sync.ts:167-181`, `src/syncs/build.sync.ts:60-64`, `src/concepts/Filing/FilingConcept.ts:33-34`, `src/concepts/Routing/RoutingConcept.ts:17-22`

Every watch poll immediately issues a new build. Builds mutate global concept state using `Filing.clear`, `Collecting.clear`, `Frontmattering.clear`, `Routing.configure`, and shared output config. There is no in-flight build guard, queue, coalescing, or build-scoped state.

Impact: rapid changes can interleave builds, lose scanned files, preserve stale routes/layouts, or clean files from another in-progress build.

Suggested fix: serialize builds per dev command, coalesce change events while a build is active, and scope mutable build state by build ID instead of using process-global concept state.

### ISS-009: Build startup does not clear all build-scoped concepts

Evidence: `src/syncs/build.sync.ts:60-64`, `src/concepts/Formatting/FormattingConcept.ts:12-13`, `src/concepts/Layouting/LayoutingConcept.ts:28-31`, `src/concepts/Routing/RoutingConcept.ts:17-22`

Build startup clears `Filing`, `Collecting`, and `Frontmattering`, but not `Formatting`, `Layouting`, or existing `Routing` entries. `Routing.configure` changes config without removing old derived routes.

Impact: later builds in the same process can use removed layouts, stale rendered HTML, or stale route collisions.

Suggested fix: add reset/clear actions for all build-scoped state and invoke them at build start, or make all relevant records keyed by build ID.

### ISS-026: Dev watches only source content

Evidence: `src/syncs/dev.sync.ts:34-35`

Dev mode starts one watcher for `source`, but builds also depend on layouts and public assets.

Impact: editing a layout or public asset does not trigger rebuild/reload.

Suggested fix: watch all non-empty input roots and use the same dev command context for rebuilds.

### ISS-028: No partial rebuilds or plugin boundary

Evidence: `src/syncs/dev.sync.ts:167-181`, `src/syncs/app.ts:23-36`

Every source change triggers a full build, and all concepts/syncs are statically registered in `createSyncs`.

Impact: large sites will rebuild more slowly than necessary, and extension points require editing core sync registration.

Suggested fix: track changed entries and dependent index/layout pages for partial rebuilds, and consider an explicit plugin registration boundary if extensibility becomes a goal.

## Engine Core

Issues in the sync engine: matching, evidence consumption, frame determinism, and failure isolation.

### ISS-003: Engine `when` matching can reuse the same journal action twice

Evidence: `src/engine/sync.ts:174-190`, `src/engine/sync.ts:326`

`matchWhen` joins every `when` clause against all flow actions but never prevents a single `ActionRecord` from satisfying multiple clauses in one match. A sync shaped like `when A(), A()` can fire after one `A` action.

Impact: false-positive sync firings, self-triggering loops, and tests that pass because accidental same-record matches are filtered later rather than rejected by the engine.

Suggested fix: track matched action IDs per candidate frame and reject reuse within the same `when` match unless the DSL explicitly allows same-record reuse.

### ISS-004: Engine consumes sync evidence too coarsely and before `then` succeeds

Evidence: `src/engine/actions.ts:40`, `src/engine/sync.ts:181-183`, `src/engine/sync.ts:220-238`

The `synced` map is keyed only by sync name. Once one record participates in a sync, it cannot participate in any later firing of that same sync even with different partner records. `addThen` also marks evidence consumed before running the `then` action, and caught errors only log to stderr.

Impact: valid fan-out patterns can be skipped, failed `then` actions are not retried, and downstream actions may be missing with no structured failure event.

Suggested fix: store match signatures like `sync name + ordered action-id tuple` instead of per-record sync marks, and only mark a signature consumed after all corresponding `then` actions are journaled or a structured failure is recorded.

### ISS-021: Frames/query semantics can be nondeterministic or fail late

Evidence: `src/engine/frames.ts:121-130`, `src/engine/frames.ts:146-165`, `src/engine/frames.ts:203-225`, `src/engine/frames.ts:276-291`, `src/engine/sync.ts:267-284`, `src/engine/sync.ts:333-354`

Async `Frames.query` appends results as promises resolve, so frame order depends on timing. Missing query output keys still produce frames with unbound variables. `undefined` is treated as missing in frame and pattern matching. `collectAs` groups by `String(symbol)` and JSON values, which can collide for duplicate symbol descriptions or unstable object key order.

Impact: order-sensitive syncs and collected lists can be flaky, missing query fields fail much later, and some valid JSON-ish values cannot be matched.

Suggested fix: preserve source-frame order when awaiting async queries, reject incomplete query rows immediately, use property-presence checks instead of `=== undefined`, and group using symbol identity or a stable serializer.

### ISS-022: Engine failure isolation and registration semantics are brittle

Evidence: `src/engine/sync.ts:114-126`, `src/engine/sync.ts:139-152`, `src/engine/sync.ts:316-319`, `src/engine/sync.ts:459-462`, `src/engine/actions.ts:57-89`

Re-registering a sync name overwrites `syncs[name]` but leaves old sync objects indexed in `syncsByAction`. Errors in `matchWhen`/`where`/`addThen` are not isolated per sync, so one malformed sync can abort later syncs for the same action. Thrown concept actions leave journal records without output, and journal records expose mutable inputs/outputs/maps.

Impact: hot registration or tests can double-fire stale syncs, unrelated syncs can be skipped by one throwing sync, and the journal can contain incomplete or mutable history.

Suggested fix: reject duplicate sync names or de-index old syncs, wrap each sync evaluation independently, record structured action errors, and defensively clone/freeze journal records and query results.

## Filesystem & I/O

Issues with path safety, file operations, binary handling, and content types.

### ISS-001: Filesystem paths can escape configured roots

Evidence: `src/concepts/Serving/ServingConcept.ts:60-87`, `src/concepts/Filing/FilingConcept.ts:119`, `src/concepts/Filing/FilingConcept.ts:157-160`, `src/concepts/Filing/FilingConcept.ts:215-236`, `src/concepts/Publishing/PublishingConcept.ts:118-144`, `src/concepts/Publishing/PublishingConcept.ts:231-246`, `src/runtime/cli.ts:42-58`

`Serving` concatenates URL paths to `root`, and `Filing`/`Publishing` join untrusted relative paths to output destinations. `../` and absolute-path edge cases can serve, write, or delete outside the intended roots. CLI parsing also accepts dangerous output/source relationships such as `--output .` or an output directory that contains input directories.

Impact: path traversal, accidental user-data deletion, and corrupt builds when stale cleanup runs against the wrong directory.

Suggested fix: resolve and canonicalize all roots and output paths, reject absolute or escaping relative paths, validate that output does not overlap source/layout/public roots unless explicitly forced, and make cleanup operate only after destination ownership is verified.

### ISS-014: Public asset copy corrupts binary files

Evidence: `src/syncs/assets.sync.ts:1-17`, `src/concepts/Filing/FilingConcept.ts:119-128`, `src/concepts/Filing/FilingConcept.ts:172-180`

The public asset sync says it copies files as-is but uses `Filing.read` and `Filing.write`, which force UTF-8 text decoding and encoding.

Impact: images, fonts, PDFs, and other binary assets can be corrupted during builds.

Suggested fix: add a binary-safe copy/artifact action or a dedicated asset/publishing path that streams opaque bytes instead of text content.

### ISS-027: Serving directory index content type is computed from the wrong path

Evidence: `src/concepts/Serving/ServingConcept.ts:89-108`

When `/blog` resolves to `/blog/index.html`, `file` is updated but `getContentType` still receives the original extensionless path.

Impact: directory indexes can be served as `application/octet-stream` and skip reload-script injection.

Suggested fix: track the selected filesystem path alongside the selected file and compute content type from that path.

## Parsing & Validation

Issues with regex-based parsing, CLI argument validation, frontmatter detection, and mode validation.

### ISS-015: CLI argument parsing is permissive and accepts invalid runtime state

Evidence: `src/runtime/cli.ts:33-58`, `src/syncs/dev.sync.ts:23-31`, `src/syncs/build.sync.ts:48-57`

`getArg` returns the next token even if it is another flag. Unknown flags are ignored. Ports are parsed with `parseInt`, so `abc` becomes `NaN` and `3000abc` becomes `3000`. Programmatic `Commanding.issue` calls can omit required args and still flow into build/dev syncs as `undefined` bindings.

Impact: typos become paths, invalid ports reach `Serving.start`, and malformed programmatic commands fail later with confusing sync or filesystem errors.

Suggested fix: implement strict option parsing and validate required args in `where` clauses, emitting `Commanding.fail` with clear errors before any build/dev actions run.

### ISS-018: Layout rendering hides missing layout bugs and uses brittle regex parsing

Evidence: `src/concepts/Layouting/LayoutingConcept.ts:22-26`, `src/concepts/Layouting/LayoutingConcept.ts:92-103`, `src/concepts/Layouting/LayoutingConcept.ts:169-179`, `src/concepts/Layouting/LayoutingConcept.ts:215-262`

Missing layouts silently fall back to raw content. Template parsing uses regexes for component tags, slots, variables, and loops. Raw `{{#each}}`, `{{title}}`, or capitalized HTML-like tags in markdown/code blocks can collide with layout rendering.

Impact: typos and load-order bugs can build successfully with missing wrappers, and page body content can accidentally corrupt templates.

Suggested fix: make missing layouts an error unless explicitly opting out, parse templates with a real parser or constrained AST, and define escaping/code-block behavior.

### ISS-023: CommandLine waits are non-unique and weakly validated

Evidence: `src/concepts/CommandLine/CommandLineConcept.ts:72-90`, `src/concepts/CommandLine/CommandLineConcept.ts:212-223`

`waitFor` accepts any `mode` string and overwrites an existing wait. `_getByOperation` returns only the first matching invocation even though uniqueness is not enforced.

Impact: multiple invocations waiting for the same operation can leave some invocations unnotified, and typoed modes create waits that no sync observes.

Suggested fix: validate `mode` as an enum, reject or explicitly replace existing waits, and either enforce one waiter per operation or return all matching invocations.

### ISS-024: Frontmatter parse behavior is easy to mis-detect and may be silent

Evidence: `src/concepts/Frontmattering/FrontmatteringConcept.ts:56-74`, `src/concepts/Frontmattering/FrontmatteringConcept.ts:179-202`, `src/syncs/content.sync.ts:116-145`

The closing fence search uses `indexOf("\n---")`, which can match `---anything` or YAML content lines instead of a fence line. YAML parse errors are notices, not build failures, and the notice sync requires a `CommandLine.invoke` in the same flow, which watcher-triggered rebuilds may not have.

Impact: frontmatter can be split incorrectly, CI builds can pass with invalid metadata, and dev rebuild parse errors can be silent.

Suggested fix: require a closing fence line that exactly matches `---` with optional whitespace, or use a frontmatter parser. Decide whether parse errors are fatal; if not, propagate dev invocation context so notices are visible.

## Testing

### ISS-025: Test isolation and regression coverage leave flaky areas unprotected

Evidence: `src/engine/test/cases.matching.test.ts`, `src/engine/test/cases.basic.test.ts`, `src/syncs/app.test.ts`, `src/concepts/Serving/ServingConcept.test.ts`, `src/concepts/Filing/FilingConcept.test.ts`, `src/concepts/Publishing/PublishingConcept.test.ts`

Engine tests mostly cover happy paths and counts, not same-record reuse, fan-out after one antecedent, failure consumption, stale matches, async query ordering, thrown actions, or per-sync failure isolation. Some concept/sync tests use shared temp-dir/server state and cleanup only after all tests.

Impact: the flakiest engine and filesystem behaviors can regress without tests failing, and test runs can leak temp directories or ports.

Suggested fix: add focused regression tests for each engine invariant and move temp dirs/servers to per-test setup/cleanup with assigned ports where possible.
