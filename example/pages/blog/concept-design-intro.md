---
title: What Is Concept Design?
layout: Blog
date: 2026-06-05
collections: posts
description: An introduction to the concept-design architecture pattern — why it exists, how it works, and when to use it.
---

## What Is Concept Design?

Concept Design is a software architecture pattern where applications are built from **independent, reusable behavioral units** called concepts, composed by **declarative synchronizations**.

### The Problem It Solves

Traditional application architectures — MVC, layered, microservices — all suffer from the same fundamental issue: **implicit coupling**. A controller knows about models. A service knows about repositories. A component imports a hook. These dependencies are not declared; they're buried in import statements and method calls.

When you try to reuse a piece of functionality in a different context, you discover it's entangled with assumptions about the application it was built for. The authentication module assumes a user profile exists. The profile module assumes a session. The session module assumes HTTP cookies.

Concept Design breaks this chain by enforcing a single rule: **no concept may import another concept**.

### How Concepts Work

A concept is a class with:
- **State** — in-memory maps (or database collections) that store entities
- **Actions** — async methods that mutate state and return typed results
- **Queries** — read-only methods that return arrays of rows

Concepts are instrumented by the sync engine. Every action invocation creates a journal entry. Syncs match these entries and fire follow-up actions.

```typescript
// A Filing concept — knows nothing about markdown, layouts, or routing
class FilingConcept {
  async scan({ directory, patterns }): Promise<{ entries: ID[] }> { ... }
  async read({ entry }): Promise<{ entry, content }> { ... }
  async write({ entry }): Promise<{ entry, outputPath }> { ... }
}
```

### Why It Matters

**Testability.** Each concept is tested in isolation with an in-memory state. No mocks, no stubs — just instantiate and call actions.

**Reusability.** A `Routing` concept built for a static site generator can be reused in a CMS, a wiki, or a documentation tool — without modification.

**Clarity.** The application's behavior is declared in sync files, not scattered across middleware, hooks, and callbacks. You can read the syncs and understand exactly what happens when.

**Modularity.** Swap out concepts without touching anything else. Want a different template engine? Replace `Layouting` with `HandlebarsTemplating`. The syncs (and all other concepts) don't change.
