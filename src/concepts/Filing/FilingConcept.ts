import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { freshID } from "@utils/database.ts";
import type { Empty, ID } from "@utils/types.ts";
import { Glob } from "bun";

type Entry = ID;

interface EntryDoc {
  _id: Entry;
  path: string;
  extension: string;
  root: string;
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
  private config: { outputDirectory: string } = { outputDirectory: "" };

  constructor(namespace?: string) {
    void namespace;
  }

  async scan({
    directory,
    patterns,
    outputDirectory,
    source,
    command,
  }: {
    directory: string;
    patterns: string[];
    outputDirectory: string;
    source: string;
    command?: string;
  }): Promise<
    | { source: string; entries: Entry[]; command?: string }
    | { error: string; command?: string }
  > {
    if (directory === "") {
      this.config = { outputDirectory };
      return { source, entries: [], command };
    }

    try {
      const dirStat = await stat(directory);
      if (!dirStat.isDirectory()) {
        return { error: `Not a directory: ${directory}`, command };
      }
    } catch {
      return { error: `Directory does not exist: ${directory}`, command };
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

    this.config = { outputDirectory };

    return { source, entries: entryIds, command };
  }

  async read({
    entry,
    command,
  }: {
    entry: Entry;
    command?: string;
  }): Promise<
    | { entry: Entry; content: string; command?: string }
    | { error: string; command?: string }
  > {
    const doc = this.entries.get(entry);
    if (doc === undefined) {
      return { error: `Entry not found: ${entry}`, command };
    }

    const fullPath = path.join(doc.root, doc.path);
    let content: string;
    try {
      content = await readFile(fullPath, "utf-8");
    } catch {
      return { error: `Failed to read file: ${fullPath}`, command };
    }

    doc.content = content;
    return { entry, content, command };
  }

  async write({
    entry,
    outputRelativePath,
    command,
  }: {
    entry: Entry;
    outputRelativePath?: string;
    command?: string;
  }): Promise<
    | { entry: Entry; outputPath: string; command?: string }
    | { error: string; command?: string }
  > {
    const doc = this.entries.get(entry);
    if (doc === undefined) {
      return { error: `Entry not found: ${entry}`, command };
    }
    if (doc.content === undefined) {
      return {
        error: `Entry has no content — call read first: ${entry}`,
        command,
      };
    }
    if (this.config.outputDirectory === "") {
      return { error: "No Config found — call scan first", command };
    }

    const outputPath = path.join(
      this.config.outputDirectory,
      outputRelativePath ?? doc.path,
    );
    const outputDir = path.dirname(outputPath);

    try {
      await mkdir(outputDir, { recursive: true });
    } catch (err) {
      return {
        error: `Failed to create output directory: ${String(err)}`,
        command,
      };
    }

    try {
      await writeFile(outputPath, doc.content, "utf-8");
    } catch (err) {
      return { error: `Failed to write file: ${String(err)}`, command };
    }
    doc.written = true;
    doc.outputPath = outputPath;

    return { entry, outputPath, command };
  }

  async setContent({
    entry,
    content,
    command,
  }: {
    entry: Entry;
    content: string;
    command?: string;
  }): Promise<
    { entry: Entry; command?: string } | { error: string; command?: string }
  > {
    const doc = this.entries.get(entry);
    if (doc === undefined) {
      return { error: `Entry not found: ${entry}`, command };
    }
    doc.content = content;
    return { entry, command };
  }

  async clear(): Promise<Empty> {
    this.entries.clear();
    return {};
  }

  /**
   * cleanOutput (): ({ removed }) | ({ error })
   *
   * **requires** output directory is configured
   *
   * **effects** recursively walks the output directory and removes any file
   *   whose relative path does not match an entry with `written: true`
   */
  async cleanOutput(): Promise<{ removed: number } | { error: string }> {
    if (this.config.outputDirectory === "") {
      return { error: "No output directory configured" };
    }

    const writtenPaths = new Set(
      [...this.entries.values()]
        .filter((e) => e.written && e.outputPath)
        .map((e) => e.outputPath ?? ""),
    );

    let removed = 0;
    try {
      removed = await this.#removeStale(
        this.config.outputDirectory,
        writtenPaths,
      );
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
      content?: string;
      outputPath?: string;
      written: boolean;
      source: string;
    }[]
  > {
    const doc = this.entries.get(entry);
    if (doc === undefined) return [];

    const outputPath =
      this.config.outputDirectory !== ""
        ? path.join(this.config.outputDirectory, doc.path)
        : undefined;

    return [
      {
        path: doc.path,
        extension: doc.extension,
        root: doc.root,
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
    if (this.config.outputDirectory === "") return [];
    return [{ outputDirectory: this.config.outputDirectory }];
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
