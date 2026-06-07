---
title: Filesystem & I/O Issues
layout: Blog
---

## Filesystem & I/O Issues

These issues are about path safety, file operations, binary content handling, and content-type correctness.

### ISS-001: Filesystem paths can escape configured roots

**Problem:** `Serving`, `Filing`, and `Publishing` join request paths or relative paths to configured roots without canonicalization. `../` and absolute path inputs can serve, write, or delete outside the intended directory. CLI accepts dangerous arguments like `--output .`.

**Why it matters:** Path traversal. Accidental data deletion. Corrupt builds when stale cleanup runs against the wrong directory.

**Repair direction:** Resolve and canonicalize all roots and paths. Reject absolute or escaping relative paths. Validate that output does not overlap input directories. Verify output ownership before cleanup.

### ISS-014: Public asset copy corrupts binary files

**Problem:** The public asset sync copies files through `Filing.read` and `Filing.write`, which force UTF-8 text encoding and decoding.

**Why it matters:** Images, fonts, PDFs, and other binary files are corrupted during builds.

**Repair direction:** Add a binary-safe copy action. Stream opaque bytes through a dedicated asset path instead of text I/O.

### ISS-027: Directory index content type computed from wrong path

**Problem:** When `/blog` resolves to `/blog/index.html`, the content type is computed from the original extensionless request path rather than the resolved filesystem path.

**Why it matters:** Directory index pages can be served as `application/octet-stream` and skip live-reload script injection.

**Repair direction:** Track the resolved filesystem path alongside the file and compute content type from that path.

### ISS-028: No partial rebuilds or plugin boundary

**Problem:** Every source change triggers a full rebuild. Sync registration is static.

**Why it matters:** Large sites rebuild unnecessarily slowly. Extensions require editing core sync registration.

**Repair direction:** Track changed entries and dependent pages for partial rebuilds. Consider a plugin registration boundary when extensibility becomes a goal.

## Related

- [Concept Design Issues](/issues/concept-design) — independence and identity problems
- [Sync Layer Issues](/issues/sync-layer) — pipeline gating and error propagation
- [Back to Issue Review](/issues)
