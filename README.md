# Concept Design Framework

A demonstration of **concept design**: independent behavioral units implemented as **concepts** and composed by declarative **synchronizations**. The framework produces a static site generator, but the contribution is the decomposition — concepts own their state, never import each other, and are wired together by sync rules with no imperative orchestration.

The [example site](example/) is the canonical documentation. Build it to browse the field guide, design rules, full app specification, architecture reference, and issue review.

## Quick Start

```bash
bun install
bun run example:build      # build example/dist
bun run example:dev        # dev server with live reload
```

## Scripts

| Command | Description |
|---|---|
| `bun run example:build` | Build the example site |
| `bun run example:dev` | Serve with live reload |
| `bun test` | Run the test suite |
| `bun run typecheck` | Type-check with `tsc --noEmit` |
| `bun run check` | Lint and format check with biome |

## Where Things Are

- `design/` — background reading on concept design methodology
- `src/concepts/` — concept implementations (one class per folder)
- `src/syncs/` — sync rules that compose concepts
- `src/engine/` — journal, frame matching, sync runner
- `example/` — the canonical documentation site (also the build fixture)

Build the example site to read the full docs — including the field guide, architecture walkthrough, design rules, app specification, and issue review.

## License

MIT
