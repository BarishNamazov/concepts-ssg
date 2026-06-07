/**
 * Directory snapshot utility — computes a content hash of a directory tree
 * for use as a Watching snapshot.  Independent of any concept; pure function.
 * Uses Bun-native APIs.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Compute a stable hash string representing the state of a directory.
 * Uses file paths + mtimes as the change signal.
 * Returns empty string for nonexistent or empty directories.
 */
export async function snapshotPath(root: string): Promise<string> {
  const files: { path: string; mtime: number }[] = [];

  try {
    statSync(root);
  } catch {
    return "";
  }

  walkSync(root, root, files);

  if (files.length === 0) return "";

  files.sort((a, b) => a.path.localeCompare(b.path));

  const parts = files.map((f) => `${f.path}:${f.mtime}`);
  return hashString(parts.join("\n"));
}

/** Hash a string using Bun.CryptoHasher. */
export function hashString(input: string): string {
  if (!input) return "";
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(input);
  return hasher.digest("hex").slice(0, 16);
}

function walkSync(
  root: string,
  dir: string,
  out: { path: string; mtime: number }[],
) {
  let entries: { name: string; isDirectory: () => boolean }[];
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as unknown as {
      name: string;
      isDirectory: () => boolean;
    }[];
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = fullPath.slice(root.length + 1);
    if (entry.isDirectory()) {
      walkSync(root, fullPath, out);
    } else {
      try {
        const s = statSync(fullPath);
        out.push({ path: relativePath, mtime: s.mtimeMs });
      } catch {
        // skip unreadable
      }
    }
  }
}
