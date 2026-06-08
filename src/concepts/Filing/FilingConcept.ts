import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { freshID } from "@utils/id.ts";
import type { Empty, ID } from "@utils/types.ts";
import { safeJoin } from "@utils/path_guard.ts";
import { Glob } from "bun";

type Entry = ID;

interface EntryDoc {
  _id: Entry;
  path: string;
  extension: string;
  root: string;
  outputDirectory: string;
  content?: string;
  written: boolean;
  /** The full output path this entry was last written to. */
  outputPath?: string;
  source: string;
}

function extensionOf(filePath: string): string {
  return path.extname(filePath).replace(/^\./, "");
}

export default class FilingConcept {
  private entries = new Map<Entry, EntryDoc>();

  async scan({
    directory,
    patterns,
    outputDirectory,
    source,
  }: {
    directory: string;
    patterns: string[];
    outputDirectory: string;
    source: string;
  }): Promise<{ source: string; entries: Entry[] } | { error: string }> {
    if (directory === "") {
      return { source, entries: [] };
    }

    try {
      const dirStat = await stat(directory);
      if (!dirStat.isDirectory()) {
        return { error: `Not a directory: ${directory}` };
      }
    } catch {
      return { error: `Directory does not exist: ${directory}` };
    }

    const docs: EntryDoc[] = [];
    for (const pattern of patterns) {
      const glob = new Glob(pattern);
      for await (const relativePath of glob.scan({ cwd: directory })) {
        const fullPath = path.join(directory, relativePath);
        try {
          const fileStat = await stat(fullPath);
          if (!fileStat.isFile()) continue;
        } catch {
          continue;
        }
        const ext = extensionOf(relativePath);
        docs.push({
          _id: freshID(),
          path: relativePath,
          extension: ext,
          root: directory,
          outputDirectory,
          written: false,
          source,
        });
      }
    }

    const entryIds: Entry[] = [];
    for (const doc of docs) {
      this.entries.set(doc._id, doc);
      entryIds.push(doc._id);
    }
    return { source, entries: entryIds };
  }

  async read({
    entry,
  }: {
    entry: Entry;
  }): Promise<{ entry: Entry; content: string } | { error: string }> {
    const doc = this.entries.get(entry);
    if (doc === undefined) {
      return { error: `Entry not found: ${entry}` };
    }

    const fullPath = path.join(doc.root, doc.path);
    let content: string;
    try {
      content = await readFile(fullPath, "utf-8");
    } catch {
      return { error: `Failed to read file: ${fullPath}` };
    }

    doc.content = content;
    return { entry, content };
  }

  async write({
    entry,
    outputRelativePath,
  }: {
    entry: Entry;
    outputRelativePath?: string;
  }): Promise<{ entry: Entry; outputPath: string } | { error: string }> {
    const doc = this.entries.get(entry);
    if (doc === undefined) {
      return { error: `Entry not found: ${entry}` };
    }
    if (doc.content === undefined) {
      return { error: `Entry has no content — call read first: ${entry}` };
    }
    if (doc.outputDirectory === "") {
      return { error: "No Config found — call scan first" };
    }

    const outputPath = safeJoin(
      doc.outputDirectory,
      outputRelativePath ?? doc.path,
    );
    if (typeof outputPath !== "string") return outputPath;
    const outputDir = path.dirname(outputPath);

    try {
      await mkdir(outputDir, { recursive: true });
    } catch (err) {
      return { error: `Failed to create output directory: ${String(err)}` };
    }

    try {
      await writeFile(outputPath, doc.content, "utf-8");
    } catch (err) {
      return { error: `Failed to write file: ${String(err)}` };
    }
    doc.written = true;
    doc.outputPath = outputPath;

    return { entry, outputPath };
  }

  async setContent({
    entry,
    content,
  }: {
    entry: Entry;
    content: string;
  }): Promise<{ entry: Entry } | { error: string }> {
    const doc = this.entries.get(entry);
    if (doc === undefined) {
      return { error: `Entry not found: ${entry}` };
    }
    doc.content = content;
    return { entry };
  }

  async clear(): Promise<Empty> {
    this.entries.clear();
    return {};
  }

  /**
   * cleanOutput ({ outputDirectory }): ({ removed }) | ({ error })
   *
   * **requires** `outputDirectory` is provided
   *
   * **effects** recursively walks the output directory and removes any file
   *   whose path does not match an entry written to that output directory
   */
  async cleanOutput({
    outputDirectory,
  }: {
    outputDirectory: string;
  }): Promise<{ removed: number } | { error: string }> {
    if (outputDirectory === "") {
      return { error: "No output directory configured" };
    }

    const resolvedOutput = path.resolve(outputDirectory);

    const writtenPaths = new Set(
      [...this.entries.values()]
        .filter(
          (e) =>
            e.outputDirectory === outputDirectory && e.written && e.outputPath,
        )
        .map((e) => e.outputPath ?? ""),
    );

    let removed = 0;
    try {
      removed = await this.#removeStale(resolvedOutput, writtenPaths);
    } catch (err) {
      return { error: `Failed to clean output: ${String(err)}` };
    }

    return { removed };
  }

  async _getEntry({ entry }: { entry: Entry }): Promise<
    {
      path: string;
      extension: string;
      root: string;
      outputDirectory: string;
      content?: string;
      outputPath?: string;
      written: boolean;
      source: string;
    }[]
  > {
    const doc = this.entries.get(entry);
    if (doc === undefined) return [];

    const outputPath =
      doc.outputPath ??
      (doc.outputDirectory !== ""
        ? path.join(doc.outputDirectory, doc.path)
        : undefined);

    return [
      {
        path: doc.path,
        extension: doc.extension,
        root: doc.root,
        outputDirectory: doc.outputDirectory,
        content: doc.content,
        outputPath,
        written: doc.written,
        source: doc.source,
      },
    ];
  }

  async _getAll(): Promise<
    { entry: Entry; path: string; extension: string; source: string }[]
  > {
    return [...this.entries.values()].map((doc) => ({
      entry: doc._id,
      path: doc.path,
      extension: doc.extension,
      source: doc.source,
    }));
  }

  async _getByExtension({
    extension,
  }: {
    extension: string;
  }): Promise<{ entry: Entry; path: string; extension: string }[]> {
    return [...this.entries.values()]
      .filter((doc) => doc.extension === extension)
      .map((doc) => ({
        entry: doc._id,
        path: doc.path,
        extension: doc.extension,
      }));
  }

  async _getContent({
    entry,
  }: {
    entry: Entry;
  }): Promise<{ content: string }[]> {
    const doc = this.entries.get(entry);
    if (doc === undefined || doc.content === undefined) return [];
    return [{ content: doc.content }];
  }

  async _getBySource({
    source,
  }: {
    source: string;
  }): Promise<{ entry: Entry; path: string; extension: string }[]> {
    return [...this.entries.values()]
      .filter((doc) => doc.source === source)
      .map((doc) => ({
        entry: doc._id,
        path: doc.path,
        extension: doc.extension,
      }));
  }

  async _getConfig(): Promise<{ outputDirectory: string }[]> {
    const outputDirectories = new Set(
      [...this.entries.values()]
        .map((doc) => doc.outputDirectory)
        .filter((outputDirectory) => outputDirectory !== ""),
    );
    return [...outputDirectories].map((outputDirectory) => ({
      outputDirectory,
    }));
  }

  /** Recursively remove files in `dir` that are not in `keep` set. */
  async #removeStale(dir: string, keep: Set<string>): Promise<number> {
    let removed = 0;
    let entries: { name: string; isDir: boolean }[];
    try {
      const dirents = await readdir(dir, { withFileTypes: true });
      entries = dirents.map((d) => ({
        name: d.name,
        isDir: d.isDirectory(),
      }));
    } catch {
      return 0;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDir) {
        removed += await this.#removeStale(fullPath, keep);
        try {
          const remaining = await readdir(fullPath);
          if (remaining.length === 0) {
            await rm(fullPath, { recursive: true });
          }
        } catch {
          // ignore
        }
      } else if (!keep.has(fullPath)) {
        await rm(fullPath);
        removed++;
      }
    }
    return removed;
  }
}
