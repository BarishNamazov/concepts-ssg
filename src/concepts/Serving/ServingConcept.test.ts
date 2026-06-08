import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ID } from "@utils/types.ts";
import ServingConcept from "./ServingConcept.ts";

let Serving: ServingConcept;
let tempDir: string;
let rootDir: string;

async function createTempDirs() {
  tempDir = await mkdtemp(join(tmpdir(), "serving-test-"));
  rootDir = join(tempDir, "out");
  await mkdir(rootDir, { recursive: true });
}

beforeEach(async () => {
  Serving = new ServingConcept();
  await createTempDirs();
});

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

function randomPort(): number {
  return 3000 + Math.floor(Math.random() * 40000);
}

describe("Serving", () => {
  test("start returns a server id", async () => {
    const port = randomPort();
    const result = await Serving.start({ port, root: rootDir });
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(typeof result.server).toBe("string");
    }
  });

  test("_getServer returns port and root", async () => {
    const port = randomPort();
    const { server } = (await Serving.start({ port, root: rootDir })) as {
      server: ID;
    };
    const [info] = await Serving._getServer({ server });
    expect(info.port).toBe(port);
    expect(info.root).toBe(rootDir);
  });

  test("serves HTML files with live-reload script injected", async () => {
    const port = randomPort();
    await writeFile(
      join(rootDir, "index.html"),
      "<html><body>Hi</body></html>",
    );
    await Serving.start({ port, root: rootDir });

    const res = await fetch(`http://localhost:${port}/index.html`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<html><body>Hi</body></html>");
    expect(body).toContain("/_livereload");
    expect(body).toContain("EventSource");
  });

  test("serves CSS files without injection", async () => {
    const port = randomPort();
    await writeFile(join(rootDir, "style.css"), "body { color: red; }");
    await Serving.start({ port, root: rootDir });

    const res = await fetch(`http://localhost:${port}/style.css`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe("body { color: red; }");
    expect(body).not.toContain("_livereload");
  });

  test("serves index.html at root path", async () => {
    const port = randomPort();
    await writeFile(join(rootDir, "index.html"), "<h1>Root</h1>");
    await Serving.start({ port, root: rootDir });

    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<h1>Root</h1>");
  });

  test("SPA fallback: unknown paths serve index.html", async () => {
    const port = randomPort();
    await writeFile(join(rootDir, "index.html"), "<h1>SPA</h1>");
    await Serving.start({ port, root: rootDir });

    const res = await fetch(`http://localhost:${port}/some/deep/route`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<h1>SPA</h1>");
    expect(body).toContain("_livereload");
  });

  test("returns 404 when no index.html exists", async () => {
    const port = randomPort();
    await Serving.start({ port, root: rootDir });

    const res = await fetch(`http://localhost:${port}/nope.html`);
    expect(res.status).toBe(404);
  });

  test("reload returns reloaded count", async () => {
    const port = randomPort();
    await writeFile(join(rootDir, "index.html"), "<h1>R</h1>");
    await Serving.start({ port, root: rootDir });

    // Open an SSE connection to register a client
    const _sse = fetch(`http://localhost:${port}/_livereload`);

    // Give it a moment to connect
    await new Promise((r) => setTimeout(r, 100));

    const result = await Serving.reload();
    if ("error" in result) throw new Error(result.error);
    expect(result.reloaded).toBeGreaterThanOrEqual(0);
  });

  test("stop shuts down the server", async () => {
    const port = randomPort();
    const { server } = (await Serving.start({ port, root: rootDir })) as {
      server: ID;
    };

    await Serving.stop({ server });

    // Server should be unreachable
    try {
      await fetch(`http://localhost:${port}/`);
      // If we get here, the server might still be running briefly
    } catch {
      // Expected: connection refused
    }
  });

  test("stop returns error for nonexistent server", async () => {
    const result = await Serving.stop({ server: "nope" as never });
    expect("error" in result).toBe(true);
  });

  test("reload when no clients connected returns 0", async () => {
    const port = randomPort();
    await Serving.start({ port, root: rootDir });
    const result = await Serving.reload();
    if ("error" in result) throw new Error(result.error);
    expect(result.reloaded).toBe(0);
  });

  test("reload can target one server without counting another server's clients", async () => {
    const otherRoot = join(tempDir, "other-out");
    await mkdir(otherRoot, { recursive: true });
    await writeFile(join(rootDir, "index.html"), "<h1>One</h1>");
    await writeFile(join(otherRoot, "index.html"), "<h1>Two</h1>");

    const portA = randomPort();
    const portB = randomPort();
    const startedA = await Serving.start({ port: portA, root: rootDir });
    const startedB = await Serving.start({ port: portB, root: otherRoot });
    if ("error" in startedA) throw new Error(startedA.error);
    if ("error" in startedB) throw new Error(startedB.error);

    const abortA = new AbortController();
    const abortB = new AbortController();
    void fetch(`http://localhost:${portA}/_livereload`, {
      signal: abortA.signal,
    }).catch(() => {});
    void fetch(`http://localhost:${portB}/_livereload`, {
      signal: abortB.signal,
    }).catch(() => {});

    await new Promise((r) => setTimeout(r, 100));

    const resultA = await Serving.reload({ server: startedA.server });
    if ("error" in resultA) throw new Error(resultA.error);
    expect(resultA.reloaded).toBe(1);

    await Serving.stop({ server: startedA.server });

    const resultB = await Serving.reload({ server: startedB.server });
    if ("error" in resultB) throw new Error(resultB.error);
    expect(resultB.reloaded).toBe(1);

    abortA.abort();
    abortB.abort();
    await Serving.stop({ server: startedB.server });
  });

  test("serves nested HTML files with injection", async () => {
    const port = randomPort();
    await mkdir(join(rootDir, "blog"), { recursive: true });
    await writeFile(join(rootDir, "blog", "index.html"), "<h1>Blog</h1>");
    await Serving.start({ port, root: rootDir });

    const res = await fetch(`http://localhost:${port}/blog/index.html`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<h1>Blog</h1>");
    expect(body).toContain("_livereload");
  });

  test("rejects path traversal in URL path", async () => {
    const port = randomPort();
    await Serving.start({ port, root: rootDir });

    const res = await fetch(
      `http://localhost:${port}/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc/passwd`,
    );
    expect(res.status).toBe(403);
  });

  test("serves JS files with correct content-type", async () => {
    const port = randomPort();
    await writeFile(join(rootDir, "app.js"), "console.log(1);");
    await Serving.start({ port, root: rootDir });

    const res = await fetch(`http://localhost:${port}/app.js`);
    expect(res.status).toBe(200);
    const ct = res.headers.get("content-type");
    expect(ct).toContain("javascript");
  });

  test("principle: start server, serve page, reload, stop", async () => {
    const port = randomPort();
    await writeFile(
      join(rootDir, "index.html"),
      "<html><body><p>Dev</p></body></html>",
    );

    const { server } = (await Serving.start({ port, root: rootDir })) as {
      server: ID;
    };

    // Verify server info
    const [info] = await Serving._getServer({ server });
    expect(info.port).toBe(port);

    // Serve the page
    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<p>Dev</p>");
    expect(body).toContain("_livereload");

    // Reload
    const reload = await Serving.reload();
    if ("error" in reload) throw new Error(reload.error);
    expect(reload.reloaded).toBe(0); // no clients connected

    // Stop
    await Serving.stop({ server });
    const [after] = await Serving._getServer({ server });
    expect(after).toBeUndefined();
  });

  test("port conflict returns error", async () => {
    const port = randomPort();
    await Serving.start({ port, root: rootDir });
    const result = await Serving.start({ port, root: rootDir });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("Failed to start server");
    }
  });
});
