import { beforeEach, describe, expect, test } from "bun:test";
import type { ID } from "@utils/types.ts";
import LayoutingConcept from "./LayoutingConcept.ts";

let Layouting: LayoutingConcept;

beforeEach(() => {
  Layouting = new LayoutingConcept();
});

describe("Layouting", () => {
  test("define registers a layout", async () => {
    const { layout } = await Layouting.define({
      name: "Header",
      source: "<header>Title</header>",
    });

    const results = await Layouting._getLayout({ name: "Header" });
    expect(results.length).toBe(1);
    expect(results[0].layout).toBe(layout);
    expect(results[0].source).toBe("<header>Title</header>");
  });

  test("define detects sub-layout references", async () => {
    await Layouting.define({
      name: "Page",
      source: "<Header /><main>Body</main>",
    });

    const uses = await Layouting._getUses({ layout: "Page" as ID });
    expect(uses.length).toBe(1);
    expect(uses[0].name).toBe("Header" as ID);
  });

  test("compose resolves a simple layout", async () => {
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

    const stored = await Layouting._getComposed({ entry });
    expect(stored.length).toBe(1);
    expect(stored[0].composed).toBe("<h1>Hello</h1><div><p>World</p></div>");
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

  test("principle: define Header, Footer, and Blog; compose Blog; apply with content", async () => {
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

    const composeResult = await Layouting.compose({ layoutName: "Blog" });
    if ("error" in composeResult) {
      throw new Error(`Unexpected error: ${composeResult.error}`);
    }
    expect(composeResult.composed).toContain("<header>");
    expect(composeResult.composed).toContain("<footer>");
    expect(composeResult.composed).toContain("{{title}}");
    expect(composeResult.composed).toContain("{{content}}");

    const entry = "blog-entry-1" as ID;
    const applyResult = await Layouting.apply({
      entry,
      layoutName: "Blog",
      variables: {
        title: "My Blog",
        content: "<article>Hello World</article>",
      },
    });

    if ("error" in applyResult) {
      throw new Error(`Unexpected error: ${applyResult.error}`);
    }
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
});
