---
title: Parsing & Validation Issues
layout: Blog
---

## Parsing & Validation Issues

These issues are about regex-based parsing, input validation, and fragile detection logic.

### ISS-015: CLI argument parsing is permissive

**Problem:** `getArg` returns the next token even if it is another flag. Unknown flags are silently ignored. Ports parsed with `parseInt` accept garbage values (`"abc"` becomes `NaN`, `"3000abc"` becomes `3000`). Programmatic `Commanding.issue` calls can omit required args.

**Why it matters:** Typos become paths. Invalid ports reach the server. Syncs fail much later with confusing errors that are hard to trace to the bad input.

**Repair direction:** Implement strict option parsing. Validate required args in `where` clauses. Emit `Commanding.fail` with clear errors before any work starts.

### ISS-018: Layout rendering hides missing layouts and uses brittle regex parsing

**Problem:** Missing layouts silently fall back to raw content. Template tags are parsed with regular expressions. Raw template syntax in markdown or code blocks can collide with template rendering.

**Why it matters:** Layout typos and load-order bugs can build successfully. Page body content can accidentally corrupt template output.

**Repair direction:** Make missing layouts an error. Parse templates with a real parser or constrained AST. Define escaping and code-block behavior.

### ISS-023: CommandLine waits are non-unique and weakly validated

**Problem:** `waitFor` accepts any mode string and overwrites existing waits. `_getByOperation` returns only the first waiter. Uniqueness is not enforced.

**Why it matters:** Multiple invocations waiting for the same operation can leave some unnotified. Typoed mode strings create waits no sync observes.

**Repair direction:** Validate mode as an enum. Reject or explicitly replace existing waits. Enforce one waiter per operation or return all matching waiters.

### ISS-024: Frontmatter close-fence detection is fragile

**Problem:** The closing `---` fence is detected with `indexOf("\n---")`, which matches `---anything` in YAML content. YAML parse errors are notices, not build failures. Dev rebuilds may lack the `CommandLine.invoke` needed for notice visibility.

**Why it matters:** Frontmatter can split incorrectly. CI builds can pass with invalid metadata. Dev rebuild parse errors may be silent.

**Repair direction:** Require an exact match on `\n---\n` or use a frontmatter parser. Decide whether parse errors should be fatal. If notices are used, propagate dev invocation context so they remain visible.

## Related

- [Concept Design Issues](/issues/concept-design) — independence and identity problems
- [Sync Layer Issues](/issues/sync-layer) — pipeline gating and error propagation
- [Back to Issue Review](/issues)
