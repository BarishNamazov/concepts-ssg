import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import PublishingConcept from "./PublishingConcept.ts";

let Publishing: PublishingConcept;
let tempDir: string;
let outputDir: string;

async function createTempDirs() {
  tempDir = await mkdtemp(join(tmpdir(), "publishing-test-"));
  outputDir = join(tempDir, "out");
  await mkdir(outputDir, { recursive: true });
}

beforeEach(async () => {
  Publishing = new PublishingConcept();
  await createTempDirs();
});

afterAll(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

describe("Publishing", () => {
  test("begin creates a publication in STAGING status", async () => {
    const { publication } = await Publishing.begin({ destination: outputDir });
    expect(typeof publication).toBe("string");
    const [doc] = await Publishing._getStatus({ publication });
    expect(doc.status).toBe("STAGING");
  });

  test("begin with command uses it as publication id", async () => {
    const { publication } = await Publishing.begin({
      destination: outputDir,
      command: "pub-1",
    });
    expect(publication as string).toBe("pub-1");
  });

  test("stage stores an artifact", async () => {
    const { publication } = await Publishing.begin({ destination: outputDir });
    const result = await Publishing.stage({
      publication,
      relativePath: "index.html",
      content: "<h1>Hi</h1>",
    });
    expect("error" in result).toBe(false);

    const artifacts = await Publishing._getArtifacts({ publication });
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].relativePath).toBe("index.html");
  });

  test("stage returns error for nonexistent publication", async () => {
    const result = await Publishing.stage({
      publication: "nope" as never,
      relativePath: "x",
      content: "",
    });
    expect("error" in result).toBe(true);
  });

  test("stage returns error when not STAGING", async () => {
    const { publication } = await Publishing.begin({ destination: outputDir });
    await Publishing.commit({ publication });
    const result = await Publishing.stage({
      publication,
      relativePath: "y",
      content: "",
    });
    expect("error" in result).toBe(true);
  });

  test("commit writes staged artifacts to disk", async () => {
    const { publication } = await Publishing.begin({ destination: outputDir });
    await Publishing.stage({
      publication,
      relativePath: "index.html",
      content: "<h1>Hello</h1>",
    });

    await Publishing.commit({ publication });

    const content = await readFile(join(outputDir, "index.html"), "utf-8");
    expect(content).toBe("<h1>Hello</h1>");

    const [doc] = await Publishing._getStatus({ publication });
    expect(doc.status).toBe("PUBLISHED");
  });

  test("commit removes stale files from previous build", async () => {
    // Pre-populate a stale file
    await writeFile(join(outputDir, "stale.html"), "old");

    const { publication } = await Publishing.begin({ destination: outputDir });
    await Publishing.stage({
      publication,
      relativePath: "index.html",
      content: "new",
    });

    await Publishing.commit({ publication });

    // New file exists
    const content = await readFile(join(outputDir, "index.html"), "utf-8");
    expect(content).toBe("new");

    // Stale file removed
    try {
      await readFile(join(outputDir, "stale.html"), "utf-8");
      expect(true).toBe(false); // should not reach here
    } catch {
      // expected
    }
  });

  test("commit preserves nested directory structure", async () => {
    const { publication } = await Publishing.begin({ destination: outputDir });
    await Publishing.stage({
      publication,
      relativePath: "blog/post/index.html",
      content: "<h1>Post</h1>",
    });
    await Publishing.stage({
      publication,
      relativePath: "style.css",
      content: "body{}",
    });

    await Publishing.commit({ publication });

    const post = await readFile(
      join(outputDir, "blog", "post", "index.html"),
      "utf-8",
    );
    expect(post).toBe("<h1>Post</h1>");

    const css = await readFile(join(outputDir, "style.css"), "utf-8");
    expect(css).toBe("body{}");
  });

  test("commit returns error for nonexistent publication", async () => {
    const result = await Publishing.commit({ publication: "nope" as never });
    expect("error" in result).toBe(true);
  });

  test("commit returns error when already PUBLISHED", async () => {
    const { publication } = await Publishing.begin({ destination: outputDir });
    await Publishing.stage({
      publication,
      relativePath: "a",
      content: "a",
    });
    await Publishing.commit({ publication });
    const result = await Publishing.commit({ publication });
    expect("error" in result).toBe(true);
  });

  test("fail marks publication as FAILED", async () => {
    const { publication } = await Publishing.begin({ destination: outputDir });
    await Publishing.fail({ publication, error: "disk full" });

    const [doc] = await Publishing._getStatus({ publication });
    expect(doc.status).toBe("FAILED");
    expect(doc.error).toBe("disk full");
  });

  test("fail returns error for nonexistent publication", async () => {
    const result = await Publishing.fail({
      publication: "nope" as never,
      error: "x",
    });
    expect("error" in result).toBe(true);
  });

  test("_getArtifacts returns empty for publication with no artifacts", async () => {
    const { publication } = await Publishing.begin({ destination: outputDir });
    const artifacts = await Publishing._getArtifacts({ publication });
    expect(artifacts).toHaveLength(0);
  });

  test("_getStatus returns empty for unknown publication", async () => {
    const docs = await Publishing._getStatus({ publication: "nope" as never });
    expect(docs).toHaveLength(0);
  });

  test("principle: stage multiple artifacts, commit, verify all written and stale removed", async () => {
    // Pre-populate a file from a previous build
    await writeFile(join(outputDir, "old.html"), "old");

    const { publication } = await Publishing.begin({ destination: outputDir });

    await Publishing.stage({
      publication,
      relativePath: "index.html",
      content: "<h1>Home</h1>",
    });
    await Publishing.stage({
      publication,
      relativePath: "about/index.html",
      content: "<h1>About</h1>",
    });
    await Publishing.stage({
      publication,
      relativePath: "style.css",
      content: "*{}",
    });

    const result = await Publishing.commit({ publication });
    expect("error" in result).toBe(false);

    // All staged files exist
    expect(await readFile(join(outputDir, "index.html"), "utf-8")).toBe(
      "<h1>Home</h1>",
    );
    expect(
      await readFile(join(outputDir, "about", "index.html"), "utf-8"),
    ).toBe("<h1>About</h1>");
    expect(await readFile(join(outputDir, "style.css"), "utf-8")).toBe("*{}");

    // Stale file removed
    let staleExists = false;
    try {
      await readFile(join(outputDir, "old.html"), "utf-8");
      staleExists = true;
    } catch {
      // expected
    }
    expect(staleExists).toBe(false);

    // Status is PUBLISHED
    const [doc] = await Publishing._getStatus({ publication });
    expect(doc.status).toBe("PUBLISHED");
  });
});
