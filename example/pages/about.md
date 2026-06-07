---
title: About
---
## About This Project

This static site generator is built entirely from **concept-design** primitives. Every piece of functionality is a standalone, reusable concept:

- **Filing** — filesystem I/O
- **Frontmattering** — YAML metadata extraction
- **Formatting** — markdown to HTML
- **Routing** — filesystem-based URL routing with auto-hydrated index pages
- **Layouting** — Astro-style nestable layout composition
- **Commanding** — CLI boundary

These concepts know nothing about each other. A set of sync rules wires them together into a build pipeline.
