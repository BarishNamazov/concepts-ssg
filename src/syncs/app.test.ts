import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConcepts } from "@concepts";
import FormattingConcept from "@concepts/Formatting/FormattingConcept.ts";
import { Logging } from "@engine";
import { createSyncs } from "./app.ts";

class BlockingFormattingConcept extends FormattingConcept {
  block = false;
  private releases: (() => void)[] = [];

  override async render(input: Parameters<FormattingConcept["render"]>[0]) {
    if (this.block) {
      await new Promise<void>((resolve) => this.releases.push(resolve));
    }
    return await super.render(input);
  }

  get waiting(): number {
    return this.releases.length;
  }

  releaseOne(): void {
    const release = this.releases.shift();
    if (release === undefined) throw new Error("No blocked render to release");
    release();
  }
}

async function setupApp() {
  const app = createConcepts();
  app.Engine.logging = Logging.OFF;
  const syncs = createSyncs(app);
  app.Engine.register(syncs);
  return app;
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1000,
): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function buildIssueCount(app: Awaited<ReturnType<typeof setupApp>>): number {
  return [...app.Engine.Action.actions.values()].filter(
    (record) => record.input.name === "build",
  ).length;
}

let tempDir: string;
let sourceDir: string;
let outputDir: string;
let layoutsDir: string;

async function createTempDirs() {
  tempDir = await mkdtemp(join(tmpdir(), "sync-test-"));
  sourceDir = join(tempDir, "pages");
  outputDir = join(tempDir, "dist");
  layoutsDir = join(tempDir, "layouts");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await mkdir(layoutsDir, { recursive: true });
}

beforeEach(async () => {
  await createTempDirs();
});

afterAll(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

describe("syncs: scan → read → parse cascades", () => {
  test("content scan cascades to Frontmattering.parse", async () => {
    const app = await setupApp();
    await writeFile(
      join(sourceDir, "post.md"),
      "---\ntitle: Hello\n---\nContent",
    );

    await app.Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "content",
    });

    const all = await app.Filing._getAll();
    expect(all).toHaveLength(1);

    const body = await app.Frontmattering._getBody({ entry: all[0].entry });
    expect(body).toHaveLength(1);
    expect(body[0].body).toContain("Content");

    const fields = await app.Frontmattering._getAllFields({
      entry: all[0].entry,
    });
    expect(fields).toHaveLength(1);
    expect(fields[0].fields.title).toBe("Hello");
  });

  test("content scan cascades to Formatting.render", async () => {
    const app = await setupApp();
    await writeFile(join(sourceDir, "page.md"), "# Title\n\nParagraph");

    await app.Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "content",
    });

    const all = await app.Filing._getAll();
    const html = app.Formatting._getHtml({ entry: all[0].entry });
    expect(html).toHaveLength(1);
    expect(html[0].html).toContain("<h1>Title</h1>");
  });

  test("HTML files pass through unchanged", async () => {
    const app = await setupApp();
    await writeFile(join(sourceDir, "existing.html"), "<div>Raw HTML</div>");

    await app.Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.{md,html,htm}"],
      outputDirectory: outputDir,
      source: "content",
    });

    const all = await app.Filing._getAll();
    const html = app.Formatting._getHtml({ entry: all[0].entry });
    expect(html).toHaveLength(1);
    expect(html[0].html).toBe("<div>Raw HTML</div>");
  });

  test("content scan cascades to Routing.derive", async () => {
    const app = await setupApp();
    await writeFile(join(sourceDir, "about.md"), "# About");

    await app.Routing.configure({ stripPrefix: "pages" });

    await app.Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "content",
    });

    const all = await app.Filing._getAll();
    const routes = await app.Routing._getRoute({ entry: all[0].entry });
    expect(routes).toHaveLength(1);
    expect(routes[0].route).toBe("/about");
  });

  test("content scan cascades to Collecting.collect", async () => {
    const app = await setupApp();
    await writeFile(
      join(sourceDir, "post.md"),
      "---\ntitle: My Post\ncollections: posts\n---\nBody",
    );

    await app.Routing.configure({ stripPrefix: "pages" });

    await app.Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "content",
    });

    const entries = await app.Collecting._getEntries({ collection: "posts" });
    expect(entries.length).toBeGreaterThan(0);
    const found = entries.find((e) => e.metadata.title === "My Post");
    expect(found).toBeDefined();
  });

  test("layout scan cascades to Layouting.define", async () => {
    const app = await setupApp();
    await writeFile(
      join(layoutsDir, "Header.html"),
      "<header>{{title}}</header>",
    );
    await writeFile(join(layoutsDir, "default.html"), "<main><slot/></main>");

    await app.Filing.scan({
      directory: layoutsDir,
      patterns: ["*.html"],
      outputDirectory: outputDir,
      source: "layouts",
    });

    const headerLayout = await app.Layouting._getLayout({ name: "Header" });
    expect(headerLayout).toHaveLength(1);
    expect(headerLayout[0].source).toBe("<header>{{title}}</header>");

    const defaultLayout = await app.Layouting._getLayout({ name: "default" });
    expect(defaultLayout).toHaveLength(1);
  });

  test("scan → read → parse → render → route → collect → apply → write (full pipeline for one file)", async () => {
    const app = await setupApp();

    await app.Layouting.define({
      name: "default",
      source: "<main><slot/></main>",
    });

    await writeFile(
      join(sourceDir, "page.md"),
      "---\ntitle: Pipeline Test\nlayout: default\ncollections: posts\n---\n\n<p>Content</p>",
    );

    await app.Routing.configure({ stripPrefix: "pages" });

    await app.Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "content",
    });

    const all = await app.Filing._getAll();
    expect(all).toHaveLength(1);

    const routes = await app.Routing._getRoute({ entry: all[0].entry });
    expect(routes).toHaveLength(1);
    expect(routes[0].route).toBe("/page");

    const html = app.Formatting._getHtml({ entry: all[0].entry });
    expect(html).toHaveLength(1);
    expect(html[0].html).toContain("<p>Content</p>");

    const composed = await app.Layouting._getComposed({
      entry: all[0].entry,
    });
    expect(composed).toHaveLength(1);
    expect(composed[0].composed).toContain("<main><p>Content</p></main>");

    const collected = await app.Collecting._getEntries({
      collection: "posts",
    });
    const found = collected.find((e) => e.metadata.title === "Pipeline Test");
    expect(found).toBeDefined();

    const entryDoc = await app.Filing._getEntry({ entry: all[0].entry });
    expect(entryDoc[0].written).toBe(true);
  });
});

describe("Filing source field", () => {
  test("_getBySource and _getAll distinguish layout vs content entries", async () => {
    const app = await setupApp();
    await writeFile(join(layoutsDir, "layout.html"), "<div></div>");
    await writeFile(join(sourceDir, "page.md"), "# Page");

    await app.Filing.scan({
      directory: layoutsDir,
      patterns: ["*.html"],
      outputDirectory: outputDir,
      source: "layouts",
    });
    await app.Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "content",
    });

    const all = await app.Filing._getAll();
    const layoutEntries = all.filter((e) => e.source === "layouts");
    const contentEntries = all.filter((e) => e.source === "content");
    expect(layoutEntries).toHaveLength(1);
    expect(contentEntries).toHaveLength(1);

    const bySource = await app.Filing._getBySource({ source: "layouts" });
    expect(bySource).toHaveLength(1);
  });
});

describe("integration: full build", () => {
  let integrationTemp: string;
  let intSource: string;
  let intOutput: string;
  let intLayouts: string;

  beforeEach(async () => {
    integrationTemp = await mkdtemp(join(tmpdir(), "sync-int-"));
    intSource = join(integrationTemp, "pages");
    intOutput = join(integrationTemp, "dist");
    intLayouts = join(integrationTemp, "layouts");
    await mkdir(intSource, { recursive: true });
    await mkdir(intOutput, { recursive: true });
    await mkdir(intLayouts, { recursive: true });
  });

  afterAll(async () => {
    if (integrationTemp) {
      await rm(integrationTemp, { recursive: true, force: true }).catch(
        () => {},
      );
    }
  });

  test("builds a simple site with layouts", async () => {
    const app = await setupApp();

    await writeFile(
      join(intLayouts, "BaseLayout.html"),
      "<!DOCTYPE html><html><body><slot/></body></html>",
    );
    await writeFile(
      join(intLayouts, "default.html"),
      "<BaseLayout><slot/></BaseLayout>",
    );
    await writeFile(join(intSource, "index.md"), "# Welcome");
    await writeFile(
      join(intSource, "about.md"),
      "---\ntitle: About\n---\n\nWe make things.",
    );

    await app.Commanding.issue({
      name: "build",
      args: { source: intSource, output: intOutput, layouts: intLayouts },
    });

    const indexContent = await readFile(join(intOutput, "index.html"), "utf-8");
    expect(indexContent).toContain("Welcome");
    expect(indexContent).toContain("<!DOCTYPE html>");

    const aboutContent = await readFile(
      join(intOutput, "about", "index.html"),
      "utf-8",
    );
    expect(aboutContent).toContain("We make things");
    expect(aboutContent).toContain("<!DOCTYPE html>");
  });

  test("build command transitions to SUCCEEDED after build completes", async () => {
    const app = await setupApp();
    await writeFile(join(intSource, "index.md"), "# Welcome");

    const result = await app.Commanding.issue({
      name: "build",
      args: { source: intSource, output: intOutput },
    });

    const [cmdDoc] = await app.Commanding._get({ command: result.command });
    expect(cmdDoc.status).toBe("SUCCEEDED");
    expect(cmdDoc.name).toBe("build");
  });

  test("builds with blog index using {{#each}}", async () => {
    const app = await setupApp();

    await writeFile(
      join(intLayouts, "BaseLayout.html"),
      "<!DOCTYPE html><html><head><title>{{title}}</title></head><body><slot/></body></html>",
    );
    await writeFile(
      join(intLayouts, "default.html"),
      "<BaseLayout><slot/></BaseLayout>",
    );

    await mkdir(join(intSource, "blog"), { recursive: true });
    await writeFile(
      join(intSource, "blog", "index.md"),
      "---\ntitle: Blog\ntype: index\n---\n\n<h1>Posts</h1>\n{{#each posts}}\n<p>{{title}} ({{date}})</p>\n{{/each}}",
    );
    await writeFile(
      join(intSource, "blog", "post-one.md"),
      "---\ntitle: Post One\ndate: 2024-01-01\ncollections: posts\n---\n\nOne.",
    );
    await writeFile(
      join(intSource, "blog", "post-two.md"),
      "---\ntitle: Post Two\ndate: 2024-06-01\ncollections: posts\n---\n\nTwo.",
    );

    await app.Commanding.issue({
      name: "build",
      args: { source: intSource, output: intOutput, layouts: intLayouts },
    });

    const blogIndexContent = await readFile(
      join(intOutput, "blog", "index.html"),
      "utf-8",
    );

    expect(blogIndexContent).toContain("Posts");
    expect(blogIndexContent).toContain("Post One");
    expect(blogIndexContent).toContain("2024-01-01");
    expect(blogIndexContent).toContain("Post Two");
    expect(blogIndexContent).toContain("2024-06-01");
  });

  test("builds without layouts directory (raw HTML output)", async () => {
    const app = await setupApp();
    await writeFile(join(intSource, "index.md"), "# Plain");

    await app.Commanding.issue({
      name: "build",
      args: { source: intSource, output: intOutput },
    });

    const content = await readFile(join(intOutput, "index.html"), "utf-8");
    expect(content).toContain("<h1>Plain</h1>");
  });

  test("two builds do not leak state", async () => {
    const app = await setupApp();
    await writeFile(join(intSource, "first.md"), "# First");

    await app.Commanding.issue({
      name: "build",
      args: { source: intSource, output: intOutput },
    });

    let content = await readFile(
      join(intOutput, "first", "index.html"),
      "utf-8",
    );
    expect(content).toContain("First");

    const secondSource = join(integrationTemp, "pages2");
    const secondOutput = join(integrationTemp, "dist2");
    await mkdir(secondSource, { recursive: true });
    await mkdir(secondOutput, { recursive: true });

    await writeFile(join(secondSource, "second.md"), "# Second");

    await app.Commanding.issue({
      name: "build",
      args: { source: secondSource, output: secondOutput },
    });

    content = await readFile(
      join(secondOutput, "second", "index.html"),
      "utf-8",
    );
    expect(content).toContain("Second");

    const firstRemains = await readFile(
      join(secondOutput, "first", "index.html"),
    ).catch(() => "missing");
    expect(firstRemains).toBe("missing");
  });

  test("HTML passthrough files are preserved", async () => {
    const app = await setupApp();

    await writeFile(
      join(intLayouts, "BaseLayout.html"),
      "<!DOCTYPE html><html><body><slot/></body></html>",
    );
    await writeFile(
      join(intLayouts, "default.html"),
      "<BaseLayout><slot/></BaseLayout>",
    );

    await writeFile(
      join(intSource, "existing.html"),
      '---\ntitle: Existing\n---\n<div class="custom">Already formatted</div>',
    );

    await app.Commanding.issue({
      name: "build",
      args: { source: intSource, output: intOutput, layouts: intLayouts },
    });

    const htmlContent = await readFile(
      join(intOutput, "existing", "index.html"),
      "utf-8",
    );

    expect(htmlContent).toContain('<div class="custom">');
    expect(htmlContent).toContain("Already formatted");
    expect(htmlContent).toContain("<!DOCTYPE html>");
  });
});

// ── Regression tests for confirmed defects ─────────────────────────────

describe("regression: build failures", () => {
  test("missing source directory fails the build", async () => {
    const app = await setupApp();

    const result = await app.Commanding.issue({
      name: "build",
      args: { source: "/nonexistent/path", output: "/tmp/out" },
    });

    const [cmd] = await app.Commanding._get({ command: result.command });
    expect(cmd.status).toBe("FAILED");
    expect(cmd.error).toContain("Directory does not exist");

    const scanErrors = [...app.Engine.Action.actions.values()].filter(
      (record) => record.input.source === "content" && record.output?.error,
    );
    expect(scanErrors).toHaveLength(1);
    expect(scanErrors[0].output).not.toHaveProperty("command");
  });

  test("missing layouts directory does NOT fail the build (layouts optional)", async () => {
    const app = await setupApp();
    await writeFile(join(sourceDir, "index.md"), "# Hi");

    const result = await app.Commanding.issue({
      name: "build",
      args: { source: sourceDir, output: outputDir },
    });

    const [cmd] = await app.Commanding._get({ command: result.command });
    expect(cmd.status).toBe("SUCCEEDED");

    const content = await readFile(join(outputDir, "index.html"), "utf-8");
    expect(content).toContain("Hi");
  });
});

describe("regression: route collisions", () => {
  test("duplicate routes are rejected", async () => {
    const app = await setupApp();
    await app.Routing.configure({ stripPrefix: "pages" });

    const e1 = "entry-1" as never;
    const e2 = "entry-2" as never;

    await app.Routing.derive({ entry: e1, filePath: "pages/about.md" });

    const result = await app.Routing.derive({
      entry: e2,
      filePath: "pages/about/index.md",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("Route collision");
    }
  });
});

describe("regression: scan-specific reads", () => {
  test("content scan does not re-read layout entries", async () => {
    const app = await setupApp();
    await writeFile(join(layoutsDir, "layout.html"), "<div></div>");
    await writeFile(join(sourceDir, "page.md"), "# Page");

    // Scan layouts first — triggers reads for layout entries
    await app.Filing.scan({
      directory: layoutsDir,
      patterns: ["*.html"],
      outputDirectory: outputDir,
      source: "layouts",
    });

    // Verify layout entries have content from the layout scan's reads
    const allAfterLayout = await app.Filing._getAll();
    const layoutEntry = allAfterLayout.find((e) => e.source === "layouts");
    expect(layoutEntry).toBeDefined();
    const layoutDoc = await app.Filing._getEntry({
      entry: layoutEntry?.entry ?? ("none" as never),
    });
    expect(layoutDoc[0].content).toBeDefined();

    // Now scan content — should NOT re-read layout entries
    await app.Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "content",
    });

    // Content entries should be read, layout entries should NOT have been
    // read from the content directory (which would cause "Failed to read file" errors)
    const all = await app.Filing._getAll();
    const contentEntries = all.filter((e) => e.source === "content");
    for (const e of contentEntries) {
      const doc = await app.Filing._getEntry({ entry: e.entry });
      expect(doc[0].content).toBeDefined();
    }
  });
});

describe("regression: collection membership preservation (ISS-019)", () => {
  test("route metadata update via Routing.derive preserves collections", async () => {
    const app = await setupApp();
    await writeFile(
      join(sourceDir, "post.md"),
      "---\ntitle: My Post\ncollections: posts\n---\nBody",
    );

    await app.Routing.configure({ stripPrefix: "pages" });

    await app.Filing.scan({
      directory: sourceDir,
      patterns: ["**/*.md"],
      outputDirectory: outputDir,
      source: "content",
    });

    // Entry should still be in the posts collection after route update
    const entries = await app.Collecting._getEntries({ collection: "posts" });
    expect(entries).toHaveLength(1);
    expect(entries[0].entry).toBeDefined();
    expect(entries[0].metadata.title).toBe("My Post");
    // Route metadata should be merged, not replace membership
    expect(entries[0].metadata.route).toBeDefined();
  });
});

describe("regression: isolation", () => {
  test("each test gets fresh isolated concepts", async () => {
    const app1 = await setupApp();
    const app2 = await setupApp();

    await app1.Layouting.define({
      name: "default",
      source: "<main><slot/></main>",
    });

    // app2 should NOT have the layout from app1
    const layout = await app2.Layouting._getLayout({ name: "default" });
    expect(layout).toHaveLength(0);
  });
});

describe("regression: dev rebuild coalescing", () => {
  test("queues one follow-up rebuild while a rebuild is active", async () => {
    const Formatting = new BlockingFormattingConcept();
    const app = createConcepts({
      overrides: { Formatting: Formatting as never },
    });
    app.Engine.logging = Logging.OFF;
    app.Engine.register(createSyncs(app));

    await writeFile(join(sourceDir, "index.md"), "# First");
    const { command: devSession } = await app.Commanding.issue({
      name: "dev-session",
      args: { source: sourceDir, output: outputDir },
    });

    Formatting.block = true;
    const activeRequest = app.Coalescing.request({
      context: devSession,
      kind: "change",
    });

    await waitFor(() => Formatting.waiting === 1);
    expect(buildIssueCount(app)).toBe(1);

    const queuedA = await app.Coalescing.request({
      context: devSession,
      kind: "change",
    });
    const queuedB = await app.Coalescing.request({
      context: devSession,
      kind: "change",
    });

    expect(queuedA).toEqual({
      context: devSession,
      kind: "change",
      queued: true,
    });
    expect(queuedB).toEqual({
      context: devSession,
      kind: "change",
      queued: true,
    });
    expect(buildIssueCount(app)).toBe(1);

    Formatting.releaseOne();
    await waitFor(() => buildIssueCount(app) === 2 && Formatting.waiting === 1);

    Formatting.releaseOne();
    await activeRequest;

    expect(buildIssueCount(app)).toBe(2);
    const [state] = await app.Coalescing._get({ context: devSession });
    expect(state.active).toBe(false);
    expect(state.pending).toBe(false);
  });
});

describe("CLI: one-shot build via CommandLine.invoke", () => {
  let cliTemp: string;
  let cliSource: string;
  let cliOutput: string;
  let cliLayouts: string;

  beforeEach(async () => {
    cliTemp = await mkdtemp(join(tmpdir(), "cli-test-"));
    cliSource = join(cliTemp, "pages");
    cliOutput = join(cliTemp, "dist");
    cliLayouts = join(cliTemp, "layouts");
    await mkdir(cliSource, { recursive: true });
    await mkdir(cliOutput, { recursive: true });
    await mkdir(cliLayouts, { recursive: true });
  });

  afterAll(async () => {
    if (cliTemp) {
      await rm(cliTemp, { recursive: true, force: true }).catch(() => {});
    }
  });

  test("valid build argv succeeds, writes files, and reports stats", async () => {
    const app = await setupApp();
    await writeFile(join(cliSource, "index.md"), "# Hello CLI");

    await app.CommandLine.invoke({
      argv: ["build", "--source", cliSource, "--output", cliOutput],
    });

    const content = await readFile(join(cliOutput, "index.html"), "utf-8");
    expect(content).toContain("<h1>Hello CLI</h1>");

    // Stats: 1 content page, 0 layouts, 0 public
    const all = await app.Filing._getAll();
    expect(all.filter((e) => e.source === "content")).toHaveLength(1);
  });

  test("invalid argv fails the invocation", async () => {
    const app = await setupApp();

    const result = await app.CommandLine.invoke({
      argv: ["build", "--source", "src"],
    });

    const [doc] = await app.CommandLine._getInvocation({
      invocation: result.invocation,
    });
    expect(doc.status).toBe("FAILED");
    expect(doc.error).toContain("Missing required");
  });

  test("build with layouts produces composed output", async () => {
    const app = await setupApp();
    await app.Layouting.define({
      name: "Base",
      source: "<!DOCTYPE html><html><body><slot/></body></html>",
    });
    await app.Layouting.define({
      name: "default",
      source: "<Base><slot/></Base>",
    });
    await writeFile(
      join(cliSource, "about.md"),
      "---\ntitle: About\nlayout: default\n---\n\nAbout us.",
    );

    await app.CommandLine.invoke({
      argv: ["build", "--source", cliSource, "--output", cliOutput],
    });

    const content = await readFile(
      join(cliOutput, "about", "index.html"),
      "utf-8",
    );
    expect(content).toContain("About us.");
    expect(content).toContain("<!DOCTYPE html>");
  });

  test("build with public assets copies them", async () => {
    const app = await setupApp();
    const cliPublic = join(cliTemp, "public");
    const binaryBytes = Uint8Array.from([0xff, 0xd8, 0x00, 0xc3, 0x28, 0xd9]);
    await mkdir(cliPublic, { recursive: true });
    await mkdir(join(cliPublic, "assets"), { recursive: true });
    await writeFile(join(cliPublic, "robots.txt"), "User-agent: *");
    await writeFile(join(cliPublic, "assets", "logo.bin"), binaryBytes);
    await writeFile(join(cliSource, "index.md"), "# Home");

    await app.CommandLine.invoke({
      argv: [
        "build",
        "--source",
        cliSource,
        "--output",
        cliOutput,
        "--public",
        cliPublic,
      ],
    });

    const content = await readFile(join(cliOutput, "robots.txt"), "utf-8");
    expect(content).toBe("User-agent: *");

    const copiedBinary = await readFile(join(cliOutput, "assets", "logo.bin"));
    expect([...copiedBinary]).toEqual([...binaryBytes]);

    const publicEntries = await app.Filing._getBySource({ source: "public" });
    expect(publicEntries).toHaveLength(2);
    for (const { entry } of publicEntries) {
      expect(await app.Filing._getContent({ entry })).toEqual([]);
    }
  });

  test("build with missing source directory fails", async () => {
    const app = await setupApp();

    const result = await app.CommandLine.invoke({
      argv: [
        "build",
        "--source",
        "/nonexistent/dir/path",
        "--output",
        cliOutput,
      ],
    });

    const [doc] = await app.CommandLine._getInvocation({
      invocation: result.invocation,
    });
    expect(doc.status).toBe("FAILED");
  });

  test("CLI build completes with correct invocation lifecycle", async () => {
    const app = await setupApp();
    await writeFile(join(cliSource, "page.md"), "# Page");

    const { invocation } = await app.CommandLine.invoke({
      argv: ["build", "--source", cliSource, "--output", cliOutput],
    });

    const [doc] = await app.CommandLine._getInvocation({ invocation });
    expect(doc.status).toBe("SUCCEEDED");

    const rows = await app.CommandLine._getByOperation({
      operation: undefined as never,
    });
    expect(rows).toHaveLength(0);
  });
});
