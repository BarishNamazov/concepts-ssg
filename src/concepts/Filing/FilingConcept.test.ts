import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import FilingConcept from "./FilingConcept.ts";

type ScanSuccess = { source: string; entries: string[] };

let Filing: FilingConcept;
let tempDir: string;
let sourceDir: string;
let outputDir: string;

async function createTempDirs() {
  tempDir = await mkdtemp(join(tmpdir(), "filing-test-"));
  sourceDir = join(tempDir, "src");
  outputDir = join(tempDir, "out");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(join(sourceDir, "sub"), { recursive: true });
  await mkdir(outputDir, { recursive: true });
}

beforeEach(async () => {
  Filing = new FilingConcept();
  await createTempDirs();
});

afterAll(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe("Filing", () => {
  test("scan discovers files in a directory", async () => {
    await writeFile(join(sourceDir, "hello.md"), "# Hello");
    await writeFile(join(sourceDir, "world.md"), "# World");
    await writeFile(join(sourceDir, "sub", "nested.md"), "# Nested");
    await writeFile(join(sourceDir, "notes.txt"), "notes");

    const result = (await Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "test",
    })) as ScanSuccess;

    expect(result.source).toBe("test");
    expect(result.entries).toHaveLength(3);

    const all = await Filing._getAll();
    expect(all).toHaveLength(3);

    const paths = all.map((e) => e.path).sort();
    expect(paths).toEqual(["hello.md", "sub/nested.md", "world.md"]);

    const mdEntries = await Filing._getByExtension({ extension: "md" });
    expect(mdEntries).toHaveLength(3);

    const config = await Filing._getConfig();
    expect(config).toEqual([{ outputDirectory: outputDir }]);
  });

  test("scan returns error for nonexistent directory", async () => {
    const result = await Filing.scan({
      directory: join(tempDir, "does-not-exist"),
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "test",
    });

    expect(result).toEqual({
      error: `Directory does not exist: ${join(tempDir, "does-not-exist")}`,
    });
  });

  test("read reads file content", async () => {
    const content = "# Hi from Filing";
    await writeFile(join(sourceDir, "about.md"), content);

    await Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "test",
    });

    const all = await Filing._getAll();
    expect(all).toHaveLength(1);

    const result = await Filing.read({
      entry: all[0].entry,
    });

    expect(result).toEqual({ entry: all[0].entry, content });

    const stored = await Filing._getContent({ entry: all[0].entry });
    expect(stored).toEqual([{ content }]);
  });

  test("read returns error for nonexistent entry", async () => {
    const result = await Filing.read({
      entry: "nonexistent" as never,
    });

    expect(result).toEqual({ error: `Entry not found: nonexistent` });
  });

  test("write writes content to output directory", async () => {
    const content = "# Output Test";
    await writeFile(join(sourceDir, "page.md"), content);

    await Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "test",
    });

    const all = await Filing._getAll();
    await Filing.read({ entry: all[0].entry });

    const writeResult = await Filing.write({ entry: all[0].entry });

    expect(writeResult).toHaveProperty("entry", all[0].entry);
    expect(writeResult).toHaveProperty("outputPath");

    const outputFile = join(outputDir, "page.md");
    const { readFile } = await import("node:fs/promises");
    const writtenContent = await readFile(outputFile, "utf-8");
    expect(writtenContent).toBe(content);

    const entryDoc = await Filing._getEntry({ entry: all[0].entry });
    expect(entryDoc).toHaveLength(1);
    expect(entryDoc[0].written).toBe(true);
  });

  test("write preserves nested directory structure", async () => {
    const content = "# Deep";
    await writeFile(join(sourceDir, "sub", "deep.md"), content);

    await Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "test",
    });

    const all = await Filing._getAll();
    await Filing.read({ entry: all[0].entry });

    const writeResult = await Filing.write({ entry: all[0].entry });

    const expectedPath = join(outputDir, "sub", "deep.md");
    expect(writeResult).toEqual({
      entry: all[0].entry,
      outputPath: expectedPath,
    });

    const { readFile } = await import("node:fs/promises");
    const writtenContent = await readFile(expectedPath, "utf-8");
    expect(writtenContent).toBe(content);
  });

  test("write returns error when entry has no content", async () => {
    await writeFile(join(sourceDir, "empty.md"), "");

    await Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "test",
    });

    const all = await Filing._getAll();
    const result = await Filing.write({ entry: all[0].entry });

    expect(result).toEqual({
      error: `Entry has no content — call read first: ${all[0].entry}`,
    });
  });

  test("clear removes all entries", async () => {
    await writeFile(join(sourceDir, "a.md"), "A");
    await writeFile(join(sourceDir, "b.md"), "B");

    await Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "test",
    });

    let all = await Filing._getAll();
    expect(all).toHaveLength(2);

    await Filing.clear();

    all = await Filing._getAll();
    expect(all).toHaveLength(0);
  });

  test("_getEntry returns outputPath from the entry's output directory", async () => {
    await writeFile(join(sourceDir, "entry.md"), "entry content");

    await Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "test",
    });

    const all = await Filing._getAll();
    const entryDoc = await Filing._getEntry({ entry: all[0].entry });

    expect(entryDoc).toHaveLength(1);
    expect(entryDoc[0].path).toBe("entry.md");
    expect(entryDoc[0].extension).toBe("md");
    expect(entryDoc[0].outputPath).toBe(join(outputDir, "entry.md"));
    expect(entryDoc[0].written).toBe(false);
  });

  test("entries retain output directory after a later scan uses another output", async () => {
    await writeFile(join(sourceDir, "first.md"), "first");

    await Filing.scan({
      directory: sourceDir,
      patterns: ["first.md"],
      outputDirectory: outputDir,
      source: "first",
    });

    const [firstEntry] = await Filing._getAll();
    await Filing.read({ entry: firstEntry.entry });

    const secondSource = join(tempDir, "src2");
    const secondOutput = join(tempDir, "out2");
    await mkdir(secondSource, { recursive: true });
    await mkdir(secondOutput, { recursive: true });
    await writeFile(join(secondSource, "second.md"), "second");

    await Filing.scan({
      directory: secondSource,
      patterns: ["second.md"],
      outputDirectory: secondOutput,
      source: "second",
    });

    const result = await Filing.write({ entry: firstEntry.entry });
    expect(result).toEqual({
      entry: firstEntry.entry,
      outputPath: join(outputDir, "first.md"),
    });

    const [doc] = await Filing._getEntry({ entry: firstEntry.entry });
    expect(doc.outputPath).toBe(join(outputDir, "first.md"));
    expect(doc.outputDirectory).toBe(outputDir);
  });

  test("_getEntry returns empty array for nonexistent entry", async () => {
    const entryDoc = await Filing._getEntry({ entry: "missing" as never });
    expect(entryDoc).toEqual([]);
  });

  test("_getContent returns empty array when entry has no content", async () => {
    await writeFile(join(sourceDir, "nocontent.md"), "stuff");

    await Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "test",
    });

    const all = await Filing._getAll();
    const content = await Filing._getContent({ entry: all[0].entry });

    expect(content).toEqual([]);
  });

  test("principle: full scan → read → write cycle", async () => {
    // Given a source directory with markdown files
    await writeFile(join(sourceDir, "index.md"), "# Welcome");
    await writeFile(join(sourceDir, "about.md"), "## About");
    await writeFile(join(sourceDir, "sub", "guide.md"), "### Guide");
    await writeFile(join(sourceDir, "skip.txt"), "should be skipped");

    // When we scan for markdown files
    await Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "test",
    });

    // Then three entries are discovered
    const discovered = await Filing._getAll();
    expect(discovered).toHaveLength(3);

    // Their extensions are all "md"
    const mdEntries = await Filing._getByExtension({ extension: "md" });
    expect(mdEntries).toHaveLength(3);

    // Config stores the output directory
    const config = await Filing._getConfig();
    expect(config).toEqual([{ outputDirectory: outputDir }]);

    // When we read each entry's content
    for (const { entry } of discovered) {
      const readResult = await Filing.read({ entry });
      expect(readResult).toHaveProperty("content");
      expect(readResult).toHaveProperty("entry", entry);
    }

    // Then each entry now has content stored
    for (const { entry } of discovered) {
      const contentQuery = await Filing._getContent({ entry });
      expect(contentQuery).toHaveLength(1);
      expect(contentQuery[0].content).toBeTruthy();
    }

    // When we write each entry to the output directory
    for (const { entry } of discovered) {
      const writeResult = await Filing.write({ entry });
      expect(writeResult).toHaveProperty("outputPath");
    }

    // Then the output files exist and match the source content
    const { readFile } = await import("node:fs/promises");

    const indexContent = await readFile(join(outputDir, "index.md"), "utf-8");
    expect(indexContent).toBe("# Welcome");

    const aboutContent = await readFile(join(outputDir, "about.md"), "utf-8");
    expect(aboutContent).toBe("## About");

    const guideContent = await readFile(
      join(outputDir, "sub", "guide.md"),
      "utf-8",
    );
    expect(guideContent).toBe("### Guide");

    // The .txt file was not written (skipped during scan)
    expect(
      readFile(join(outputDir, "skip.txt")).catch(() => "missing"),
    ).resolves.toBe("missing");

    // All entries are now marked as written
    for (const { entry } of discovered) {
      const doc = await Filing._getEntry({ entry });
      expect(doc[0].written).toBe(true);
    }

    // Done — the principle is demonstrated:
    // scan discovers files, read loads their content, write persists
    // the rendered output to the output directory.
  });
});
