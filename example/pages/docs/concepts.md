---
title: Understanding Concepts
layout: Blog
---

## What Is a Concept?

A **concept** is an independent, reusable behavioral unit. It owns its own state, exposes actions for mutation, and provides queries for inspection. A concept is like a micro-service that runs in-process — it has a clear API, internal state, and no knowledge of other concepts.

### Anatomy of a Concept

Every concept has:

- **Type parameters** — Generic types for externally-owned identities (e.g., `[Entry]`, `[User]`)
- **Purpose** — What the concept does, stated independently of any application
- **Principle** — The archetypal scenario that demonstrates the concept working
- **State** — Sets of entities with typed fields (like relational tables)
- **Actions** — Operations that mutate state, each with `requires` and `effects`
- **Queries** — Read-only methods (prefixed with `_`) that return arrays of rows

### Specification Example

```yaml
concept Routing [Entry]

purpose
  assign stable, unambiguous public routes to entries

principle
  after a routing scheme is configured and an entry is assigned a path,
  the entry has one derived public route; assigning another entry that
  would use the same route is rejected

state
  a set of RoutedEntries with
    an Entry
    a filePath String
    a route String

actions
  configure (stripPrefix?, indexName?): ()
  derive (entry, filePath): (entry, route)
  remove (entry): (entry)

queries
  _getRoute (entry): (route)
  _getByRoute (route): (entry)
```

### Implementation

Each concept is a TypeScript class. State is stored in `Map` instances. Actions are `async` methods that return typed result objects. Error cases return `{ error: string }` — they never throw.

```typescript
export default class RoutingConcept {
  private entries = new Map<Entry, EntryDoc>();

  async derive({ entry, filePath }: {
    entry: ID; filePath: string;
  }): Promise<{ entry: ID; route: string } | { error: string }> {
    // compute route...
    // check for collisions...
    this.entries.set(entry, { _id: entry, filePath, route });
    return { entry, route };
  }
}
```

### The Independence Rule

A concept must never import another concept. It treats external identities (like `Entry`) as opaque — it never assumes properties about them. This is what makes concepts truly reusable across different applications.

<div class="callout">
<strong>Key insight:</strong> If your concept's purpose statement mentions application-specific terms like "blog post" or "frontmatter", it's not independent enough. A good concept purpose is generic: "assign stable routes to entries", not "derive URLs for markdown files".
</div>

### State Design

State components that can evolve independently are a warning that multiple concerns have been combined. For example, a `Filing` concept that manages file discovery, content mutation, output configuration, AND publication is doing too much. Split it into `Discovering`, `Reading`, and `Publishing`.
