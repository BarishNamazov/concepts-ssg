---
title: Task Tracker
layout: Project
collections: projects
status: Prototype
description: A CLI task management app built with the same concept-design patterns.
---

## Task Tracker (Prototype)

A command-line task tracking application demonstrating how the same concept-design patterns apply to a completely different domain.

### Concepts

```
Commanding   — CLI command dispatch (reused from SSG)
Listing      — Ordered list management (tasks, projects)
Tagging      — Tag assignment and filtering
Dueing        — Due date tracking and overdue detection
Noting        — Rich-text note attachments
```

### What's Different

The `Listing` concept is a generic ordered-list manager — it doesn't know about "tasks". It just manages items in named lists with ordering. The `Tagging` concept doesn't know about lists — it just associates tags with items. Together, they compose into a task tracker with tagged, ordered task lists.

### What's the Same

The sync patterns are identical to the SSG:

```
issue("list tasks")
  → List items in the "tasks" list
  → For each item, query tags
  → For each item, query due date
  → Render the result
```

### Why This Matters

The SSG and the task tracker share zero domain concepts — but they use the same architectural patterns, the same engine, and the same composition model. The `Commanding` concept is literally reused between them without modification.

This is the promise of Concept Design: build once, compose anywhere.
