---
title: About Concept Design
---

## What Is Concept Design?

Concept Design is a software architecture pattern where applications are built from **independent, reusable concepts** composed by **declarative synchronizations**.

Unlike traditional MVC or layered architectures, concepts are not arranged in a hierarchy. They are peers — each owning its own state, actions, and queries. They communicate only through the sync engine, which matches action patterns in an append-only journal.

### Core Principles

**Independence.** A concept must be understandable and useful without knowing which other concepts exist in the application. It never imports another concept. It treats external identities as opaque.

**Completeness.** A concept provides the full lifecycle needed to deliver its purpose: setup, normal use, mutation, deletion, and explicit failure modes.

**Separation of Concerns.** Each concept represents one coherent, reusable behavioral concern. If a concept's state has components that can evolve independently, they belong in separate concepts.

**Polymorphism.** External object types are treated as opaque identities. A concept does not allocate identities belonging to another concept's type parameter.

**Declarative Composition.** Synchronizations state causal rules — `when` / `where` / `then` — rather than imperative workflow scripts. They should not parse another concept's syntax, duplicate behavior, or depend on subtle action ordering.

### The Sync Engine

At the heart of Concept Design is a reactive synchronization engine. Every action invocation appends a record to an append-only journal. Syncs are registered as pattern-matching rules:

```
when   Filing.scan discovers entries         ← pattern match against journal
where  each entry exists and is readable      ← filter/enrich with queries
then   Filing.read the entry's content       ← fire action per surviving frame
```

The engine handles flow isolation (actions from one causal chain never cross-match with another), double-fire prevention (each journal record can only match a given sync once), and fan-out semantics (frames drop on empty query results — inner-join semantics).

### Built With Concept Design

This static site generator is itself built entirely from concept-design primitives. Every feature — file discovery, YAML parsing, markdown rendering, URL routing, template composition, output publication — is a standalone concept. None knows about any other. The entire build pipeline is declared as a set of sync rules.
