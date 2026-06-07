import { describe, expect, test } from "bun:test";
import type { ID } from "@utils/types.ts";
import FrontmatteringConcept from "./FrontmatteringConcept.ts";

const Frontmattering = new FrontmatteringConcept();

describe("Frontmattering", () => {
  test("parse extracts frontmatter and body", async () => {
    const entry = "entry:1" as ID;
    const raw = "---\ntitle: Hello\n---\nBody text";

    await Frontmattering.parse({ entry, raw });

    const [bodyResult] = await Frontmattering._getBody({ entry });
    expect(bodyResult.body).toBe("Body text");

    const [fmResult] = await Frontmattering._getFrontmatter({ entry });
    expect(fmResult.frontmatter).toBe("title: Hello");
  });

  test("parse handles content without frontmatter", async () => {
    const entry = "entry:2" as ID;
    const raw = "Just plain text without any frontmatter";

    await Frontmattering.parse({ entry, raw });

    const [bodyResult] = await Frontmattering._getBody({ entry });
    expect(bodyResult.body).toBe("Just plain text without any frontmatter");

    const [fmResult] = await Frontmattering._getFrontmatter({ entry });
    expect(fmResult.frontmatter).toBeNull();
  });

  test("_getField returns a specific frontmatter field", async () => {
    const entry = "entry:3" as ID;
    const raw =
      "---\ntitle: Hello World\ncount: 42\nactive: true\n---\nSome body";

    await Frontmattering.parse({ entry, raw });

    const [titleResult] = await Frontmattering._getField({
      entry,
      field: "title",
    });
    expect(titleResult.value).toBe("Hello World");

    const [countResult] = await Frontmattering._getField({
      entry,
      field: "count",
    });
    expect(countResult.value).toBe(42);

    const [activeResult] = await Frontmattering._getField({
      entry,
      field: "active",
    });
    expect(activeResult.value).toBe(true);
  });

  test("_getField returns empty for missing field", async () => {
    const entry = "entry:4" as ID;
    const raw = "---\ntitle: Hello\n---\nBody";

    await Frontmattering.parse({ entry, raw });

    const result = await Frontmattering._getField({
      entry,
      field: "nonexistent",
    });
    expect(result).toEqual([]);
  });

  test("_getField returns empty for entry with no frontmatter", async () => {
    const entry = "entry:nofm" as ID;
    const raw = "Plain content";

    await Frontmattering.parse({ entry, raw });

    const result = await Frontmattering._getField({ entry, field: "title" });
    expect(result).toEqual([]);
  });

  test("_getAllFields returns all key-value pairs", async () => {
    const entry = "entry:5" as ID;
    const raw = "---\ntitle: My Post\nauthor: Alice\ndraft: true\n---\n# Hello";

    await Frontmattering.parse({ entry, raw });

    const [result] = await Frontmattering._getAllFields({ entry });
    expect(result.fields).toEqual({
      title: "My Post",
      author: "Alice",
      draft: true,
    });
  });

  test("_getAllFields returns empty for entry without frontmatter", async () => {
    const entry = "entry:6" as ID;
    const raw = "No frontmatter here";

    await Frontmattering.parse({ entry, raw });

    const [result] = await Frontmattering._getAllFields({ entry });
    expect(result.fields).toEqual({});
  });

  test("principle: parse file with frontmatter, retrieve field, confirm body is clean", async () => {
    // Principle: After parsing a file that begins with YAML frontmatter
    // between `---` fences, the parsed metadata fields and the content
    // body are accessible independently.
    const entry = "post:hello-world" as ID;
    const raw = [
      "---",
      "title: Hello World",
      "date: 2024-01-15",
      "published: true",
      "---",
      "# Hello World",
      "",
      "This is the body content of the post.",
      "It should be clean of any frontmatter.",
    ].join("\n");

    await Frontmattering.parse({ entry, raw });

    // Frontmatter fields are independently accessible
    const [title] = await Frontmattering._getField({ entry, field: "title" });
    expect(title.value).toBe("Hello World");

    const [date] = await Frontmattering._getField({ entry, field: "date" });
    expect(date.value).toBe("2024-01-15");

    const [published] = await Frontmattering._getField({
      entry,
      field: "published",
    });
    expect(published.value).toBe(true);

    // Body is clean — no frontmatter lines leak through
    const [bodyResult] = await Frontmattering._getBody({ entry });
    expect(bodyResult.body).toBe(
      "# Hello World\n\nThis is the body content of the post.\nIt should be clean of any frontmatter.",
    );

    // Raw frontmatter is also accessible
    const [fmResult] = await Frontmattering._getFrontmatter({ entry });
    expect(fmResult.frontmatter).toBe(
      "title: Hello World\ndate: 2024-01-15\npublished: true",
    );
  });
});
