# Concept Design Framework

A **static site generator** built as a demonstration of concept design: independent behavioral units are implemented as **concepts** and composed by declarative **synchronizations**. The example site you can build documents the architecture from the inside.

The point is not the SSG. The point is the decomposition — 12 independent concepts wired by syncs into a build pipeline, with no concept importing another. The project also publishes a code review log (`ISSUES.md`) cataloguing where the implementation still bends.

## Concepts at a Glance

| Concept | Owns |
|---|---|
| `CommandLine` | CLI invocation lifecycle, notices, terminal result |
| `Commanding` | Generic command issue/succeed/fail lifecycle |
| `Building` | Build status (running, done) |
| `Filing` | File entries: scan, read, write, cleanup |
| `Frontmattering` | Split YAML frontmatter from markdown body |
| `Formatting` | Markdown-to-HTML rendering |
| `Routing` | File path to clean URL, collision detection |
| `Layouting` | HTML layout definitions and variable substitution |
| `Collecting` | Entry membership in named collections |
| `Publishing` | Staged artifact commits |
| `Serving` | Dev-mode static HTTP server with SSE reload |
| `Watching` | Directory snapshot comparison for change detection |

## Build the Example Site

```bash
bun install
bun run example:build      # build example/dist
bun run example:dev        # dev server with live reload
```

The example site lives under `example/`. Content is in `example/pages/` (markdown), layouts in `example/layouts/` (HTML templates), and static assets in `example/public/`. Built output goes to `example/dist/`.

## Setup

1. Install [Bun](https://bun.sh): `curl -fsSL https://bun.sh/install | bash`
2. Install dependencies: `bun install`
3. Build the example: `bun run example:build`

No database needed. Concepts store state in memory (TypeScript `Map` instances).

## Scripts

| Command | Description |
|---|---|
| `bun run example:build` | Build the example site |
| `bun run example:dev` | Build and serve with live reload |
| `bun test` | Run the test suite (in-memory, no external deps) |
| `bun run typecheck` | Type-check with `tsc --noEmit` |
| `bun run check` | Lint and format check with biome |

## Architecture

```
src/
├── concepts/          # Independent concept implementations (one folder per concept)
│   ├── concepts.ts    # Registry and createConcepts factory
│   ├── Building/
│   ├── Collecting/
│   ├── Commanding/
│   ├── CommandLine/
│   ├── Filing/
│   ├── Formatting/
│   ├── Frontmattering/
│   ├── Layouting/
│   ├── Publishing/
│   ├── Routing/
│   ├── Serving/
│   └── Watching/
├── syncs/             # Synchronizations that compose concepts (*.sync.ts)
│   ├── app.ts         # Root composition via createSyncs
│   ├── cli.sync.ts    # CLI invocation → command lifecycle
│   ├── build.sync.ts  # Build start → scans → complete → clean → succeed
│   ├── discovery.sync.ts  # Scan arrays → per-entry reads
│   ├── content.sync.ts    # Read → parse → render → route → collect
│   ├── templates.sync.ts  # Layout definitions, application, index regen
│   ├── publishing.sync.ts # Layout output → file writes
│   ├── assets.sync.ts     # Public file copying
│   ├── dev.sync.ts        # Dev server, watcher, rebuild, reload
│   ├── errors.sync.ts     # Scan error → command failure
│   ├── pipeline-errors.sync.ts  # Pipeline error → command failure
│   └── reporting.sync.ts  # Build stats summary
├── engine/            # Journal, frame matching, sync runner
├── runtime/           # CLI argument parsing, filesystem watch driver
├── utils/             # ID generation, snapshots, types
└── main.ts            # Entry point
```

- **Concepts** are self-contained TypeScript classes that own their state (in-memory maps) and expose **actions** (state mutators) and **queries** (methods returning arrays). A concept never imports another concept.
- **Synchronizations** are declarative rules of the form *when … where … then …* that compose concepts. See `design/background/implementing-synchronizations.md`.
- **The engine** drives everything: it journals actions, matches sync patterns, manages frames, and fires follow-up actions within a causal flow.

## Reading the Project

Read the example site (build it first) or the source directly:

- [Blog: This Repo in One Pass](example/pages/blog/concept-design-intro.md) — orientation tour
- [Blog: How Syncs Wire This Repo](example/pages/blog/syncs-in-this-repo.md) — the composition layer
- [Blog: The Build Pipeline](example/pages/blog/the-pipeline.md) — full execution sequence
- [Blog: Friction Log](example/pages/blog/friction-log.md) — where the model bends
- [ISSUES.md](ISSUES.md) — code review findings organized by layer
- [Design docs](design/background/) — background on concept-design methodology

## Design Rules

Read these in order before contributing:

1. `design/background/concept-design-overview.md` — what concepts are, independence, composition by synchronization
2. `design/background/concept-specifications.md` — how to write a concept spec
3. `design/background/architecture.md` — directory structure, initialization flow
4. `design/background/implementing-concepts.md` — TypeScript implementation conventions
5. `design/background/implementing-synchronizations.md` — sync DSL, when/where/then, frames, queries
6. `design/background/testing-concepts.md` — testing methodology

## License

MIT
