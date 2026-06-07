import { beforeEach, describe, expect, test } from "bun:test";
import FormattingConcept from "./FormattingConcept.ts";

let Formatting: FormattingConcept;

beforeEach(() => {
  Formatting = new FormattingConcept();
});

describe("Formatting", () => {
  describe("render", () => {
    test("converts markdown to HTML", async () => {
      const result = await Formatting.render({
        source: "# Hello",
        format: "markdown",
      });

      expect(result).toMatchObject({
        entry: expect.any(String),
        html: expect.stringContaining("h1"),
      });
    });

    test("renders paragraph text", async () => {
      const result = await Formatting.render({
        source: "Hello world",
        format: "markdown",
      });

      expect(result).toMatchObject({
        entry: expect.any(String),
        html: expect.stringContaining("<p>Hello world</p>"),
      });
    });

    test("renders bold text", async () => {
      const result = await Formatting.render({
        source: "**bold**",
        format: "markdown",
      });

      expect(result).toMatchObject({
        entry: expect.any(String),
        html: expect.stringContaining("<strong>bold</strong>"),
      });
    });

    test("returns the entry id when provided", async () => {
      const result = await Formatting.render({
        entry: "entry:test" as import("@utils/types.ts").ID,
        source: "# Test",
        format: "markdown",
      });

      expect(result).toMatchObject({
        entry: "entry:test",
        html: expect.stringContaining("h1"),
      });
    });

    test("rejects unsupported format", async () => {
      const result = await Formatting.render({
        source: "<doc>hello</doc>",
        format: "xml",
      });

      expect(result).toEqual({ error: "unsupported format: xml" });
    });
  });

  describe("_getHtml", () => {
    test("returns rendered HTML for an entry", async () => {
      const rendered = await Formatting.render({
        source: "## Subheading",
        format: "markdown",
      });

      if ("error" in rendered) {
        throw new Error("Expected success, got error");
      }

      const results = await Formatting._getHtml({ entry: rendered.entry });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ html: rendered.html });
    });

    test("returns empty array for unknown entry", async () => {
      const results = await Formatting._getHtml({
        entry: "nonexistent" as import("@utils/types.ts").ID,
      });

      expect(results).toEqual([]);
    });
  });

  describe("_getSource", () => {
    test("returns source and format for an entry", async () => {
      const rendered = await Formatting.render({
        source: "`code`",
        format: "markdown",
      });

      if ("error" in rendered) {
        throw new Error("Expected success, got error");
      }

      const results = await Formatting._getSource({ entry: rendered.entry });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        source: "`code`",
        format: "markdown",
      });
    });

    test("returns empty array for unknown entry", async () => {
      const results = await Formatting._getSource({
        entry: "nonexistent" as import("@utils/types.ts").ID,
      });

      expect(results).toEqual([]);
    });
  });

  describe("principle", () => {
    test("rendered HTML is preserved and queryable independently of source", async () => {
      const markdown = `# Static Site

Welcome to the **site**.

- item one
- item two`;

      const rendered = await Formatting.render({
        source: markdown,
        format: "markdown",
      });

      if ("error" in rendered) {
        throw new Error("Expected success, got error");
      }

      const entry = rendered.entry;
      const html = rendered.html;

      // HTML contains expected tags from the markdown
      expect(html).toContain("<h1>Static Site</h1>");
      expect(html).toContain("<strong>site</strong>");
      expect(html).toContain("<ul>");
      expect(html).toContain("<li>item one</li>");
      expect(html).toContain("<li>item two</li>");

      // html is queryable independently of source
      const htmlResults = await Formatting._getHtml({ entry });
      expect(htmlResults).toHaveLength(1);
      expect(htmlResults[0].html).toBe(html);

      // source is preserved and queryable
      const sourceResults = await Formatting._getSource({ entry });
      expect(sourceResults).toHaveLength(1);
      expect(sourceResults[0].source).toBe(markdown);
      expect(sourceResults[0].format).toBe("markdown");
    });
  });
});
