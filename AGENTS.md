# Instructions for LLM Agents

This is a concept-design static site generator built on **Bun**. Concepts are
independent, reusable units of functionality composed by declarative
synchronizations. Before writing any code, read the design rules and follow the
patterns established in this repo.

The application is a **CLI tool** that builds a static site from markdown pages
and HTML layouts. There is no HTTP API, no MongoDB, no frontend SDK. State is
stored in-memory using `Map` instances.

## First: Read the Design Rules

Before implementing anything, read these files in order:

1. `design/background/concept-design-overview.md` — what concepts are, independence, polymorphism, separation of concerns, composition by synchronization.
2. `design/background/concept-specifications.md` — how to write a concept spec (name, type params, purpose, principle, state, actions, queries).
3. `design/background/architecture.md` — project directory structure, initialization flow.
4. `design/background/implementing-concepts.md` — TypeScript implementation conventions, ID management, error handling.
5. `design/background/implementing-synchronizations.md` — sync DSL, `when`/`where`/`then` pattern, frames, query helpers, `collectAs`.
6. `design/background/testing-concepts.md` — testing methodology with in-memory state.
7. `design/background/detailed/concept-rubric.md` — rubric for evaluating concept designs.
8. `design/background/detailed/concept-state.md` — detailed state design.

## Architecture Summary

```
src/
├── concepts/          # Independent concepts (one folder per concept)
│   ├── concepts.ts    # Registry (conceptClasses + createConcepts + singletons)
│   ├── Building/      # Build lifecycle status
│   ├── Collecting/    # Named collection membership
│   ├── Commanding/    # Generic command issue/succeed/fail
│   ├── CommandLine/   # CLI invocation lifecycle, notices, terminal result
│   ├── Filing/        # File entries: scan, read, write, cleanup
│   ├── Formatting/    # Markdown-to-HTML rendering
│   ├── Frontmattering/ # YAML frontmatter + body split
│   ├── Layouting/     # HTML layout definitions and application
│   ├── Routing/       # File path → clean URL, collision detection
│   ├── Serving/       # Dev-mode HTTP server with SSE reload
│   └── Watching/      # Directory snapshot comparison
├── syncs/             # Synchronizations that wire concepts together
│   ├── app.ts         # Root composition (createSyncs)
│   ├── cli.sync.ts    # CLI invocation → command lifecycle → terminal result
│   ├── build.sync.ts  # Build start → scans → complete → clean → succeed
│   ├── discovery.sync.ts  # Scan results → per-entry reads (fan-out)
│   ├── content.sync.ts    # Read → parse → render → route → collect
│   ├── templates.sync.ts  # Layout define/apply + index regeneration
│   ├── output.sync.ts   # Layout output → file writes
│   ├── assets.sync.ts     # Public asset copy
│   ├── dev.sync.ts        # Dev server + watcher + rebuild + reload
│   ├── errors.sync.ts     # Scan error → command fail
│   ├── pipeline-errors.sync.ts  # Pipeline errors → command fail
│   └── reporting.sync.ts  # Build stats summary
├── engine/            # Sync engine (journal, matching, frames, instrumentation)
├── runtime/           # CLI arg parsing + filesystem watch driver
├── utils/             # ID generation, snapshots, types
└── main.ts            # Entry point: creates concepts, registers syncs, fires CLI
```

## Entry Point and Build Flow

`main.ts` creates concept instances via `createConcepts()`, registers syncs via
`createSyncs()`, and fires one root action:

```ts
CommandLine.invoke({ argv: Bun.argv.slice(2) })
```

Everything else is sync composition. The build pipeline emerges from `when`/`then`
rules reacting to journaled actions in the same causal flow:

```
CommandLine.invoke → Commanding.issue("build") → Building.start
  → Filing.clear → Collecting.clear → Frontmattering.clear → Routing.configure
  → Filing.scan(layouts) → Filing.scan(content) → Filing.scan(public)
  → per-file cascade: Filing.read → Frontmattering.parse
    → Formatting.render | Routing.derive | Collecting.collect
  → join: render + route → Layouting.apply → Filing.write
  → Building.complete → index regen → Filing.cleanOutput → Commanding.succeed
```

## Good Practices

### Concepts
- One class per concept at `src/concepts/{Name}/{Name}Concept.ts`.
- Concepts are fully independent — **never import another concept**.
- Every action takes a single dictionary argument and returns a dictionary.
- Error cases return `{ error: string }`, never throw except for truly exceptional cases.
- Queries are `_`-prefixed methods that always return **arrays** of rows.
- Use `ID` from `@utils/types.ts` for all identifiers. Use `freshID()` when creating new entities.
- Document each action with its signature, requires, and effects.
- When adding a new concept, register it in `src/concepts/concepts.ts` in both `conceptClasses` and the named exports.

### Synchronizations
- Sync files go under `src/syncs/` with `.sync.ts` extension.
- Use `Sync` type for internal/cross-concept syncs. This project has no HTTP endpoints — all syncs are engine-level.
- Pattern: destructure logic variables in the sync function parameter, use `actions(...)` for patterns.
- `when` patterns match on actions in the journal (same flow). `where` filters/enriches frames with queries. `then` fires actions once per surviving frame.
- Register syncs in `src/syncs/app.ts` via `createSyncs()` — they are passed to `Engine.addSyncsSync()`.
- Concepts stay local; syncs state the causal relationships.

### Build Pipeline
- The build starts at one root action. No function orchestrates the pipeline — syncs do.
- Fan-out: use `where` to expand arrays into per-entry frames, then `then` fires once per frame.
- Join: use multi-clause `when` with shared logic variables to wait for parallel results.
- Barrier: use `Building.complete` as a sync point for work that needs all entries processed.
- Error syncs: match `{ error }` output shapes to propagate failures to `Commanding.fail`.

### Testing
- Concept tests: test file lives next to the concept as `{Name}Concept.test.ts`.
- Sync integration tests: use `app.test.ts` to test the full pipeline.
- Every action should have tests confirming requires (rejection cases) and effects (state changes).
- Run all tests with `bun test`.
- Run typecheck with `bun run typecheck` (aliases `tsc --noEmit`).

### Code Quality
- Run `bun run format` (biome format), `bun run lint` (biome lint), `bun run check` (biome check) before committing.
- Follow existing patterns: avoid introducing new dependencies unless necessary.
- TypeScript strict mode is enabled. All code must typecheck.
- Use the `@engine`, `@concepts`, `@utils`, `@syncs` path aliases — never use relative imports across module boundaries.

### Adding a Feature
1. Write the concept spec (name, purpose, principle, state, actions, queries).
2. Implement the concept class under `src/concepts/{Name}/{Name}Concept.ts`.
3. Register the concept in `src/concepts/concepts.ts`.
4. Write concept tests in `src/concepts/{Name}/{Name}Concept.test.ts`.
5. Write syncs for the new behavior in `src/syncs/{name}.sync.ts`.
6. Wire syncs into `src/syncs/app.ts` via `createSyncs()`.
7. Run `bun test`, `bun run typecheck`, `bun run check`.

### The Example Site
- The example site under `example/` both documents the project and serves as build fixture.
- Content is in `example/pages/` (markdown with YAML frontmatter), layouts in `example/layouts/` (HTML with `{{variable}}` syntax).
- Build it with `bun run example:build`. Dev mode with `bun run example:dev`.
- The site includes: a field-guide blog, concept/sync docs, architecture reference, and issue review pages grouped by layer.

### Environment
No `.env` required for the SSG. The build takes CLI arguments:
```bash
bun run src/main.ts build --source example/pages --output example/dist --layouts example/layouts --public example/public
```
Dev mode adds `--dev` and an optional `--port`.
