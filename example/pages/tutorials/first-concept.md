---
title: Designing Your First Concept
layout: Tutorial
date: 2026-06-02
collections: tutorials
description: Learn how to design a concept from specification to implementation, with state, actions, queries, and tests.
---

## Designing Your First Concept

Let's design a `Filing` concept — one that discovers and reads files on disk.

### 1. Write the Specification

```yaml
concept Filing [Entry]

purpose
  discover, read, and persist files on the filesystem

principle
  after scanning a directory for matching files,
  each file's content can be read using only its entry identity;
  after rendering, content can be written to a configured output directory

state
  a set of Entries with
    a path String
    an extension String
    a root String       # the scan directory
    an optional content String
    a written Flag
    a source String     # distinguishes scans

actions
  scan (directory, patterns, outputDirectory, source):
    (source, entries) | (error)
  read (entry):
    (entry, content) | (error)
  write (entry, outputRelativePath?):
    (entry, outputPath) | (error)
  setContent (entry, content):
    (entry) | (error)
  clear ():
    ()

queries
  _getEntry (entry): (path, extension, root, content, written, source)
  _getAll (): (entry, path, extension, source)
  _getContent (entry): (content)
```

### 2. Choose Your State Type

```typescript
interface EntryDoc {
  _id: Entry;
  path: string;
  extension: string;
  root: string;        // stored so read() doesn't need directory arg
  content?: string;
  written: boolean;
  source: string;
}
```

### 3. Implement the Actions

Each action:
- Takes a single dictionary argument
- Returns a dictionary or `{ error: string }`
- Never throws (except for truly exceptional cases)

```typescript
async scan({ directory, patterns, outputDirectory, source }) {
  // Validate directory exists
  try { await stat(directory); } catch {
    return { error: `Directory does not exist: ${directory}` };
  }

  // Discover files
  const docs: EntryDoc[] = [];
  for (const pattern of patterns) {
    const glob = new Glob(pattern);
    for await (const relativePath of glob.scan({ cwd: directory })) {
      docs.push({
        _id: freshID(),
        path: relativePath,
        extension: extensionOf(relativePath),
        root: directory,
        written: false,
        source,
      });
    }
  }

  // Store entries
  const entryIds: Entry[] = [];
  for (const doc of docs) {
    this.entries.set(doc._id, doc);
    entryIds.push(doc._id);
  }

  return { source, entries: entryIds };
}
```

### 4. Implement the Queries

Queries are `_`-prefixed methods that return arrays:

```typescript
async _getAll() {
  return [...this.entries.values()].map(doc => ({
    entry: doc._id,
    path: doc.path,
    extension: doc.extension,
    source: doc.source,
  }));
}
```

### 5. Write Tests

```typescript
test("scan discovers files in a directory", async () => {
  await writeFile(join(sourceDir, "hello.md"), "# Hello");

  const result = await Filing.scan({
    directory: sourceDir,
    patterns: ["**/*.md"],
    outputDirectory: outputDir,
    source: "test",
  });

  expect(result.source).toBe("test");
  expect(result.entries).toHaveLength(1);
});

test("scan returns error for nonexistent directory", async () => {
  const result = await Filing.scan({
    directory: "/nonexistent",
    patterns: ["**/*.md"],
    outputDirectory: outputDir,
    source: "test",
  });

  expect("error" in result).toBe(true);
});
```

### Key Principles

1. **Independence** — Filing never imports another concept. It doesn't know about markdown, layouts, or routing.
2. **Complete lifecycle** — You can scan, read, write, set content, and clear. No missing operations.
3. **Explicit errors** — Error cases return `{ error }`, never throw. Success and failure are distinguishable.
4. **Stored context** — The scan root is stored per entry, so `read()` only needs the entry identity.
