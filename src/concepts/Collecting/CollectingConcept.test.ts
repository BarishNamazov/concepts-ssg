import { beforeEach, describe, expect, test } from "bun:test";
import type { ID } from "@utils/types.ts";
import CollectingConcept from "./CollectingConcept.ts";

let Collecting: CollectingConcept;

beforeEach(() => {
  Collecting = new CollectingConcept();
});

const e1 = "entry:post1" as ID;
const e2 = "entry:post2" as ID;
const e3 = "entry:index" as ID;

describe("Collecting", () => {
  test("collect stores entry metadata", async () => {
    const result = await Collecting.collect({
      entry: e1,
      collections: ["posts"],
      metadata: { title: "First Post", date: "2024-01-01" },
    });
    expect(result.entry).toBe(e1);

    const entries = await Collecting._getEntries({ collection: "posts" });
    expect(entries).toHaveLength(1);
    expect(entries[0].metadata.title).toBe("First Post");
    expect(entries[0].metadata.date).toBe("2024-01-01");
  });

  test("collect merges with existing metadata", async () => {
    await Collecting.collect({
      entry: e1,
      collections: ["posts"],
      metadata: { title: "First Post" },
    });
    await Collecting.collect({
      entry: e1,
      collections: ["posts"],
      metadata: { route: "/posts/first" },
    });

    const entries = await Collecting._getEntries({ collection: "posts" });
    expect(entries).toHaveLength(1);
    expect(entries[0].metadata.title).toBe("First Post");
    expect(entries[0].metadata.route).toBe("/posts/first");
  });

  test("collect replaces collection memberships (does not union)", async () => {
    await Collecting.collect({
      entry: e1,
      collections: ["posts", "featured"],
      metadata: { title: "Dup Post" },
    });
    await Collecting.collect({
      entry: e1,
      collections: ["posts"],
      metadata: {},
    });

    const posts = await Collecting._getEntries({ collection: "posts" });
    expect(posts).toHaveLength(1);

    // "featured" should be removed after the second collect replaced collections
    const featured = await Collecting._getEntries({ collection: "featured" });
    expect(featured).toHaveLength(0);
  });

  test("_getEntries filters by collection", async () => {
    await Collecting.collect({
      entry: e1,
      collections: ["posts"],
      metadata: { title: "Post A" },
    });
    await Collecting.collect({
      entry: e2,
      collections: ["posts"],
      metadata: { title: "Post B" },
    });
    await Collecting.collect({
      entry: e3,
      collections: ["blog"],
      metadata: { title: "Blog Entry" },
    });

    const posts = await Collecting._getEntries({ collection: "posts" });
    expect(posts).toHaveLength(2);

    const blog = await Collecting._getEntries({ collection: "blog" });
    expect(blog).toHaveLength(1);
    expect(blog[0].metadata.title).toBe("Blog Entry");
  });

  test("_getEntries returns empty for unknown collection", async () => {
    await Collecting.collect({
      entry: e1,
      collections: ["posts"],
      metadata: { title: "Post" },
    });

    const results = await Collecting._getEntries({
      collection: "nonexistent",
    });
    expect(results).toHaveLength(0);
  });

  test("_getEntries returns empty when nothing collected", async () => {
    const results = await Collecting._getEntries({ collection: "posts" });
    expect(results).toHaveLength(0);
  });

  test("finalize returns empty", async () => {
    const result = await Collecting.finalize();
    expect(result).toEqual({});
  });

  test("principle: collect two entries with same collection, verify _getEntries returns both", async () => {
    await Collecting.collect({
      entry: e1,
      collections: ["posts"],
      metadata: { title: "Hello World", date: "2024-01-01" },
    });
    await Collecting.collect({
      entry: e2,
      collections: ["posts"],
      metadata: { title: "Second Post", date: "2024-02-01" },
    });

    const entries = await Collecting._getEntries({ collection: "posts" });
    expect(entries).toHaveLength(2);
    expect(entries[0].metadata.title).toBe("Hello World");
    expect(entries[1].metadata.title).toBe("Second Post");
  });
});
