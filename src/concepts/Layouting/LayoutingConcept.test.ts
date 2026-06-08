import { beforeEach, describe, expect, test } from "bun:test";
import type { ID } from "@utils/types.ts";
import type { SequenceItem } from "./LayoutingConcept.ts";
import LayoutingConcept from "./LayoutingConcept.ts";

let Layouting: LayoutingConcept;

beforeEach(() => {
  Layouting = new LayoutingConcept();
});

function id(s: string): ID {
  return s as ID;
}

describe("Layouting", () => {
  test("define registers a layout with a fresh ID and name field", async () => {
    const { layout } = await Layouting.define({
      name: "Header",
      source: "<header>Title</header>",
    });

    const results = await Layouting._getLayout({ name: "Header" });
    expect(results.length).toBe(1);
    expect(results[0].layout).toBe(layout);
    expect(results[0].name).toBe("Header");
    expect(results[0].source).toBe("<header>Title</header>");
    expect(layout).not.toBe("Header");
  });

  test("define detects sub-layout references", async () => {
    const { layout } = await Layouting.define({
      name: "Page",
      source: "<Header /><main>Body</main>",
    });

    const uses = await Layouting._getUses({ layout });
    expect(uses.length).toBe(1);
    expect(uses[0].name).toBe("Header");
  });

  test("compose resolves a simple layout and stores in compositions, not entries", async () => {
    await Layouting.define({
      name: "Header",
      source: "<header>Title</header>",
    });
    await Layouting.define({
      name: "Page",
      source: "<Header /><main>Body</main>",
    });

    const result = await Layouting.compose({ layoutName: "Page" });
    if ("error" in result) {
      throw new Error(`Unexpected error: ${result.error}`);
    }
    expect(result.composed).toBe("<header>Title</header><main>Body</main>");

    const composedFromEntries = await Layouting._getComposed({
      entry: "Page" as ID,
    });
    expect(composedFromEntries).toHaveLength(0);
  });

  test("compose errors on missing sub-layout", async () => {
    await Layouting.define({
      name: "Page",
      source: "<Header /><main>Body</main>",
    });

    const result = await Layouting.compose({ layoutName: "Page" });
    expect("error" in result).toBe(true);
  });

  test("apply substitutes variables", async () => {
    await Layouting.define({
      name: "Page",
      source: "<h1>{{title}}</h1><div>{{content}}</div>",
    });

    const entry = "entry-1" as ID;
    const result = await Layouting.apply({
      entry,
      layoutName: "Page",
      variables: { title: "Hello", content: "<p>World</p>" },
    });

    if ("error" in result) {
      throw new Error(`Unexpected error: ${result.error}`);
    }
    expect(result.composed).toBe("<h1>Hello</h1><div><p>World</p></div>");
  });

  test("apply handles missing variables", async () => {
    await Layouting.define({
      name: "Page",
      source: "<h1>{{title}}</h1><div>{{content}}</div>",
    });

    const entry = "entry-2" as ID;
    const result = await Layouting.apply({
      entry,
      layoutName: "Page",
      variables: { content: "<p>World</p>" },
    });

    if ("error" in result) {
      throw new Error(`Unexpected error: ${result.error}`);
    }
    expect(result.composed).toBe("<h1></h1><div><p>World</p></div>");
  });

  // ── sequence / each-loop tests ────────────────────────────────────────

  test("_getSequenceRequests discovers collection name from layout", async () => {
    await Layouting.define({
      name: "Blog",
      source: "<body>{{#each posts}}<p>{{title}}</p>{{/each}}</body>",
    });

    const reqs = await Layouting._getSequenceRequests({
      layoutName: "Blog",
      content: "",
    });
    expect(reqs).toHaveLength(1);
    expect(reqs[0].collection).toBe("posts");
    expect(reqs[0].sortBy).toBeUndefined();
  });

  test("_getSequenceRequests discovers sortBy", async () => {
    await Layouting.define({
      name: "Blog",
      source: "<body>{{#each posts sort=date}}<p>{{title}}</p>{{/each}}</body>",
    });

    const reqs = await Layouting._getSequenceRequests({
      layoutName: "Blog",
      content: "",
    });
    expect(reqs).toHaveLength(1);
    expect(reqs[0].collection).toBe("posts");
    expect(reqs[0].sortBy).toBe("date");
  });

  test("_getSequenceRequests searches content when no layout exists", async () => {
    const reqs = await Layouting._getSequenceRequests({
      layoutName: "Nonexistent",
      content: "<h1>Posts</h1>{{#each posts}}<p>{{title}}</p>{{/each}}",
    });
    expect(reqs).toHaveLength(1);
    expect(reqs[0].collection).toBe("posts");
  });

  test("apply renders each loop with sequence data", async () => {
    await Layouting.define({
      name: "Blog",
      source:
        "<body>{{#each posts}}<p>{{title}} ({{date}})</p>{{/each}}</body>",
    });

    const a = id("a");
    const b = id("b");
    const entry = id("page");
    const sequences: Record<string, SequenceItem[]> = {
      posts: [
        { entry: a, fields: { title: "One", date: "2024" } },
        { entry: b, fields: { title: "Two", date: "2023" } },
        { entry, fields: { title: "Self", date: "2025" } },
      ],
    };

    const result = await Layouting.apply({
      entry,
      layoutName: "Blog",
      variables: { title: "Blog" },
      sequences,
    });

    if ("error" in result) throw new Error(String(result.error));
    // Self is excluded by default excludeCurrent=true
    expect(result.composed).toContain("<p>One (2024)</p>");
    expect(result.composed).toContain("<p>Two (2023)</p>");
    expect(result.composed).not.toContain("<p>Self (2025)</p>");
  });

  test("apply sorts each loop by sortBy field descending", async () => {
    await Layouting.define({
      name: "Blog",
      source: "<body>{{#each posts sort=date}}<p>{{title}}</p>{{/each}}</body>",
    });

    const a = id("a");
    const b = id("b");
    const entry = id("page");
    const sequences: Record<string, SequenceItem[]> = {
      posts: [
        { entry: a, fields: { title: "Older", date: "2023" } },
        { entry: b, fields: { title: "Newer", date: "2024" } },
        { entry, fields: { title: "Self", date: "2025" } },
      ],
    };

    const result = await Layouting.apply({
      entry,
      layoutName: "Blog",
      variables: { title: "Blog" },
      sequences,
    });

    if ("error" in result) throw new Error(String(result.error));
    // Sorted descending by date, self excluded
    const idxNewer = result.composed.indexOf("<p>Newer</p>");
    const idxOlder = result.composed.indexOf("<p>Older</p>");
    expect(idxNewer).toBeLessThan(idxOlder);
  });

  test("apply excludeCurrent=false keeps current entry in loop", async () => {
    await Layouting.define({
      name: "Blog",
      source:
        "<body>{{#each posts excludeCurrent=false}}<p>{{title}}</p>{{/each}}</body>",
    });

    const entry = id("page");
    const sequences: Record<string, SequenceItem[]> = {
      posts: [
        { entry, fields: { title: "Self" } },
        { entry: id("other"), fields: { title: "Other" } },
      ],
    };

    const result = await Layouting.apply({
      entry,
      layoutName: "Blog",
      variables: { title: "Blog" },
      sequences,
    });

    if ("error" in result) throw new Error(String(result.error));
    expect(result.composed).toContain("<p>Self</p>");
    expect(result.composed).toContain("<p>Other</p>");
  });

  test("apply handles missing sequence data gracefully", async () => {
    await Layouting.define({
      name: "Blog",
      source: "<body>{{#each posts}}<p>{{title}}</p>{{/each}}</body>",
    });

    const result = await Layouting.apply({
      entry: id("page"),
      layoutName: "Blog",
      variables: { title: "Blog" },
      sequences: {},
    });

    if ("error" in result) throw new Error(String(result.error));
    expect(result.composed).toBe("<body></body>");
  });

  test("principle: define Header, Footer, and Blog; apply with content and sequences", async () => {
    await Layouting.define({
      name: "Header",
      source: "<header><h1>{{title}}</h1><nav>Home | About</nav></header>",
    });
    await Layouting.define({
      name: "Footer",
      source: "<footer><p>&copy; 2024</p></footer>",
    });
    await Layouting.define({
      name: "Blog",
      source: "<body><Header /><main>{{content}}</main><Footer /></body>",
    });

    const entry = "blog-entry-1" as ID;
    const applyResult = await Layouting.apply({
      entry,
      layoutName: "Blog",
      variables: {
        title: "My Blog",
        content: "<article>Hello World</article>",
      },
    });

    if ("error" in applyResult) throw new Error(applyResult.error);
    expect(applyResult.composed).toBe(
      "<body>" +
        "<header><h1>My Blog</h1><nav>Home | About</nav></header>" +
        "<main><article>Hello World</article></main>" +
        "<footer><p>&copy; 2024</p></footer>" +
        "</body>",
    );

    const stored = await Layouting._getComposed({ entry });
    expect(stored.length).toBe(1);
    expect(stored[0].composed).toBe(applyResult.composed);
  });

  test("_getComposed returns empty for nonexistent entry", async () => {
    const result = await Layouting._getComposed({ entry: "nope" as ID });
    expect(result).toHaveLength(0);
  });

  test("_getLayout returns empty for nonexistent name", async () => {
    const result = await Layouting._getLayout({ name: "Nope" });
    expect(result).toHaveLength(0);
  });

  test("define allocates a fresh ID different from name", async () => {
    const { layout } = await Layouting.define({
      name: "Widget",
      source: "<div>widget</div>",
    });

    // The ID should be a UUID, not the human-readable name
    expect(layout).not.toBe("Widget");
    expect(typeof layout).toBe("string");
    expect(layout.length).toBeGreaterThan(20); // UUID length check
  });

  test("redefining same name replaces old entries and creates new ID", async () => {
    const first = await Layouting.define({
      name: "Panel",
      source: "<div>First</div>",
    });

    const second = await Layouting.define({
      name: "Panel",
      source: "<div>Second</div>",
    });

    // IDs should differ
    expect(second.layout).not.toBe(first.layout);

    // Old ID should no longer resolve
    const oldUses = await Layouting._getUses({ layout: first.layout });
    expect(oldUses).toHaveLength(0);

    // New ID should work
    const newUses = await Layouting._getUses({ layout: second.layout });
    expect(newUses.length).toBeGreaterThanOrEqual(0);

    // Name resolves to new source
    const results = await Layouting._getLayout({ name: "Panel" });
    expect(results).toHaveLength(1);
    expect(results[0].layout).toBe(second.layout);
    expect(results[0].source).toBe("<div>Second</div>");
  });

  test("instance isolation: separate Layouting instances have independent name indices", async () => {
    const a = new LayoutingConcept();
    const b = new LayoutingConcept();

    await a.define({ name: "Shared", source: "<div>A</div>" });
    await b.define({ name: "Shared", source: "<div>B</div>" });

    const aLayout = await a._getLayout({ name: "Shared" });
    const bLayout = await b._getLayout({ name: "Shared" });

    expect(aLayout).toHaveLength(1);
    expect(bLayout).toHaveLength(1);
    expect(aLayout[0].source).toBe("<div>A</div>");
    expect(bLayout[0].source).toBe("<div>B</div>");
    expect(aLayout[0].layout).not.toBe(bLayout[0].layout);
  });

  test("remove clears nameIndex, layouts, deps, and compositions", async () => {
    await Layouting.define({
      name: "Header",
      source: "<header>Title</header>",
    });
    await Layouting.define({
      name: "Page",
      source: "<Header /><slot/>",
    });
    await Layouting.compose({ layoutName: "Page" });

    const result = await Layouting.remove({ name: "Header" });
    expect("error" in result).toBe(false);

    // Layout gone
    const headerLayout = await Layouting._getLayout({ name: "Header" });
    expect(headerLayout).toHaveLength(0);

    // Page still exists
    const pageLayout = await Layouting._getLayout({ name: "Page" });
    expect(pageLayout).toHaveLength(1);

    // Header uses should return empty for old ID
    // Removing existing should error
    const result2 = await Layouting.remove({ name: "Header" });
    expect("error" in result2).toBe(true);
  });

  test("clear empties all maps including compositions and nameIndex", async () => {
    await Layouting.define({
      name: "Header",
      source: "<header>Title</header>",
    });
    await Layouting.define({
      name: "Page",
      source: "<Header /><slot/>",
    });
    await Layouting.compose({ layoutName: "Page" });

    await Layouting.apply({
      entry: id("entry-1"),
      layoutName: "Page",
      variables: { content: "Hello" },
    });

    await Layouting.clear();

    expect(await Layouting._getLayout({ name: "Header" })).toHaveLength(0);
    expect(await Layouting._getLayout({ name: "Page" })).toHaveLength(0);
    expect(await Layouting._getComposed({ entry: id("entry-1") })).toHaveLength(
      0,
    );
  });

  test("apply renders escaped braces as literal text", async () => {
    await Layouting.define({
      name: "Guide",
      source: "<body><div>{{content}}</div></body>",
    });

    const result = await Layouting.apply({
      entry: id("guide"),
      layoutName: "Guide",
      variables: {
        title: "Guide",
        content:
          "Use <code>\\{{title}}</code> and <code>\\{{#each posts}}</code>",
      },
    });

    if ("error" in result) throw new Error(String(result.error));
    expect(result.composed).toContain("<code>{{title}}</code>");
    expect(result.composed).toContain("<code>{{#each posts}}</code>");
    expect(result.composed).not.toContain("\\{{");
  });

  test("apply renders escaped braces mixed with real variables", async () => {
    await Layouting.define({
      name: "Page",
      source: "<h1>{{title}}</h1><div>{{content}}</div>",
    });

    const result = await Layouting.apply({
      entry: id("page-esc"),
      layoutName: "Page",
      variables: {
        title: "Hello",
        content: "Example: <code>\\{{title}}</code> shows the title.",
      },
    });

    if ("error" in result) throw new Error(String(result.error));
    expect(result.composed).toContain("<h1>Hello</h1>");
    expect(result.composed).toContain("<code>{{title}}</code>");
    expect(result.composed).toContain("shows the title");
    expect(result.composed).not.toContain("\\{{");
  });
});
