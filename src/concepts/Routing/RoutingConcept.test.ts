import { beforeEach, describe, expect, test } from "bun:test";
import type { ID } from "@utils/types.ts";
import RoutingConcept from "./RoutingConcept.ts";

let Routing: RoutingConcept;

beforeEach(() => {
  Routing = new RoutingConcept();
});

const e1 = "entry:a" as ID;
const e2 = "entry:b" as ID;
const e3 = "entry:c" as ID;
const e4 = "entry:d" as ID;

type RouteSuccess = { entry: ID; route: string };

describe("Routing", () => {
  test("derive strips prefix and extension", async () => {
    await Routing.configure({ stripPrefix: "pages" });
    const result = (await Routing.derive({
      entry: e1,
      filePath: "pages/about.md",
    })) as RouteSuccess;
    expect(result.route).toBe("/about");
    expect(result.entry).toBe(e1);
  });

  test("derive handles index files", async () => {
    await Routing.configure({ stripPrefix: "pages", indexName: "index" });
    const result = (await Routing.derive({
      entry: e2,
      filePath: "pages/blog/index.md",
    })) as RouteSuccess;
    expect(result.route).toBe("/blog");
  });

  test("derive handles top-level index", async () => {
    await Routing.configure({ stripPrefix: "pages" });
    const result = (await Routing.derive({
      entry: e3,
      filePath: "pages/index.md",
    })) as RouteSuccess;
    expect(result.route).toBe("/");
  });

  test("derive handles nested paths", async () => {
    await Routing.configure({ stripPrefix: "pages" });
    const result = (await Routing.derive({
      entry: e4,
      filePath: "pages/blog/2024/post.md",
    })) as RouteSuccess;
    expect(result.route).toBe("/blog/2024/post");
  });

  test("_getRoute returns the computed route", async () => {
    await Routing.configure({ stripPrefix: "pages" });
    await Routing.derive({ entry: e1, filePath: "pages/about.md" });
    const routes = await Routing._getRoute({ entry: e1 });
    expect(routes).toHaveLength(1);
    expect(routes[0].route).toBe("/about");
  });

  test("_getRoute returns empty for unknown entry", async () => {
    const routes = await Routing._getRoute({ entry: "nonexistent" as ID });
    expect(routes).toHaveLength(0);
  });

  test("_getByRoute returns entries matching a route", async () => {
    await Routing.configure({ stripPrefix: "pages" });
    await Routing.derive({ entry: e1, filePath: "pages/about.md" });
    const entries = await Routing._getByRoute({ route: "/about" });
    expect(entries).toHaveLength(1);
    expect(entries[0].entry).toBe(e1);
  });

  test("configure sets config values", async () => {
    const result = await Routing.configure({
      stripPrefix: "src",
      indexName: "home",
    });
    expect(result).toEqual({});
    const r = (await Routing.derive({
      entry: "t:about" as ID,
      filePath: "src/about.md",
    })) as RouteSuccess;
    expect(r.route).toBe("/about");
  });

  test("principle: configure, derive multiple paths, verify routes", async () => {
    await Routing.configure({ stripPrefix: "content", indexName: "index" });

    const r1 = (await Routing.derive({
      entry: "p:post" as ID,
      filePath: "content/posts/hello.md",
    })) as RouteSuccess;
    expect(r1.route).toBe("/posts/hello");

    const r2 = (await Routing.derive({
      entry: "p:about" as ID,
      filePath: "content/about/index.md",
    })) as RouteSuccess;
    expect(r2.route).toBe("/about");

    const r3 = (await Routing.derive({
      entry: "p:home" as ID,
      filePath: "content/index.md",
    })) as RouteSuccess;
    expect(r3.route).toBe("/");

    expect(await Routing._getRoute({ entry: "p:post" as ID })).toEqual([
      { route: "/posts/hello" },
    ]);
    expect(await Routing._getRoute({ entry: "p:about" as ID })).toEqual([
      { route: "/about" },
    ]);
    expect(await Routing._getRoute({ entry: "p:home" as ID })).toEqual([
      { route: "/" },
    ]);
    expect(await Routing._getByRoute({ route: "/posts/hello" })).toEqual([
      { entry: "p:post" as ID },
    ]);
  });

  test("derive with no prior configure uses defaults", async () => {
    const result = (await Routing.derive({
      entry: "e:defaults" as ID,
      filePath: "docs/guide/index.md",
    })) as RouteSuccess;
    expect(result.route).toBe("/docs/guide");
    expect(result.entry).toBe("e:defaults" as ID);
  });

  test("derive rejects route collisions", async () => {
    await Routing.configure({ stripPrefix: "pages" });
    await Routing.derive({ entry: e1, filePath: "pages/about.md" });
    const result = await Routing.derive({
      entry: e2,
      filePath: "pages/about/index.md",
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("Route collision");
    }
  });
});
