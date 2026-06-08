# Instructions for LLM Agents

This is a concept-design project built on **Bun**. Concepts are independent,
reusable units of functionality composed by declarative synchronizations. The
application is a **CLI tool** that builds a static site from markdown pages
and HTML layouts. There is no HTTP API, no database, no frontend SDK. State is
stored in-memory using `Map` instances.

## First: Read the Design Rules

Before implementing anything, read the design background:

1. `design/background/concept-design-overview.md` — what concepts are, independence, polymorphism, separation of concerns, composition by synchronization.
2. `design/background/concept-specifications.md` — how to write a concept spec (name, type params, purpose, principle, state, actions, queries).
3. `design/background/architecture.md` — project directory structure, initialization flow.
4. `design/background/implementing-concepts.md` — TypeScript implementation conventions, ID management, error handling.
5. `design/background/implementing-synchronizations.md` — sync DSL, `when`/`where`/`then` pattern, frames, query helpers, `collectAs`.
6. `design/background/testing-concepts.md` — testing methodology with in-memory state.
7. `design/background/detailed/concept-rubric.md` — rubric for evaluating concept designs.
8. `design/background/detailed/concept-state.md` — detailed state design.

## Discovering Architecture (Don't Hardcode It)

The architecture evolves — never bake a file tree or concept list into your
reasoning. Instead, explore it on demand:

- **Concepts**: read `src/concepts/concepts.ts` for the registry (`conceptClasses`
  and `createConcepts`). Then read individual concept files under
  `src/concepts/{Name}/{Name}Concept.ts`. Each concept is one class that owns
  its state.
- **Synchronizations**: read `src/syncs/app.ts` for `createSyncs()` — that's
  the root composition. Each sync file under `src/syncs/*.sync.ts` exports a
  factory function returning named `Sync` objects.
- **Entry point**: read `src/main.ts`. It creates concept instances, registers
  syncs, and fires one root action (typically `CommandLine.invoke`).
- **Build pipeline**: trace it from the root action by reading `cli.sync.ts`
  and `build.sync.ts`, then follow the `when`/`then` chains through
  `discovery.sync.ts`, `content.sync.ts`, `templates.sync.ts`, `output.sync.ts`,
  `assets.sync.ts`, and `dev.sync.ts`. The pipeline is emergent — no function
  orchestrates it.
- **Engine**: `src/engine/` contains the journal, frame matching, and sync runner.
  Read it when you need to understand how matching, consumption, or causal flows work.
- **Runtime**: `src/runtime/` has CLI argument parsing and the filesystem watch driver.
- **Utilities**: `src/utils/` has ID generation, path safety, types.

When you need to answer "what concepts exist" or "which syncs handle X", grep or
read the relevant files. Do not assume the list is stable.

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
- Register syncs in `src/syncs/app.ts` via `createSyncs()`.
- Concepts stay local; syncs state the causal relationships.

### Build Pipeline Patterns
- Fan-out: use `where` to expand arrays into per-entry frames, then `then` fires once per frame.
- Join: use multi-clause `when` with shared logic variables to wait for parallel results.
- Barrier: use a concept's lifecycle action (e.g. `Building.complete`) as a sync point for work that needs all entries processed.
- Error syncs: match `{ error }` output shapes to propagate failures to `Commanding.fail`.

### Testing
- Concept tests live next to the concept as `{Name}Concept.test.ts`.
- Sync integration tests live in `src/syncs/app.test.ts`.
- Every action should have tests confirming requires (rejection cases) and effects (state changes).
- Run all tests with `bun test`.
- Run typecheck with `bun run typecheck` (aliases `tsc --noEmit`).

### Code Quality
- Run `bun run check` (biome check) before committing.
- Follow existing patterns: avoid introducing new dependencies unless necessary.
- TypeScript strict mode is enabled. All code must typecheck.
- Use the `@engine`, `@concepts`, `@utils`, `@syncs` path aliases — never use relative imports across module boundaries.

## Adding a Feature

1. Read the design background above to understand the methodology.
2. Write the concept spec (name, purpose, principle, state, actions, queries).
3. Implement the concept class under `src/concepts/{Name}/{Name}Concept.ts`.
4. Register the concept in `src/concepts/concepts.ts`.
5. Write concept tests in `src/concepts/{Name}/{Name}Concept.test.ts`.
6. Write syncs for the new behavior in `src/syncs/{name}.sync.ts`.
7. Wire syncs into `src/syncs/app.ts` via `createSyncs()`.
8. Run `bun test`, `bun run typecheck`, `bun run check`.

## The Example Site

The example site under `example/` is the canonical documentation and the build
fixture. It is built from markdown pages (`example/pages/`), HTML layouts
(`example/layouts/`), and static assets (`example/public/`). Build and browse it
to understand the project:

```bash
bun run example:build     # build to example/dist/
bun run example:dev       # serve with live reload
```

## Environment

No `.env` required. The build takes CLI arguments. The example build command is:

```bash
bun run src/main.ts build --source example/pages --output example/dist --layouts example/layouts --public example/public
```

Dev mode adds `--dev` and an optional `--port`.
