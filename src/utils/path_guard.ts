import path from "node:path";

/**
 * Resolve a directory path to its absolute canonical form.
 * Safe to call on any string; returns the resolved path.
 */
export function resolveRoot(p: string): string {
  return path.resolve(path.normalize(p));
}

/**
 * Safely join a root directory with a relative path, rejecting any result
 * that escapes the root via `..` or absolute path components.
 */
export function safeJoin(
  root: string,
  relative: string,
): string | { error: string } {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relative);
  const rel = path.relative(resolvedRoot, resolved);

  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return { error: `Path traversal detected: ${relative}` };
  }

  return resolved;
}
