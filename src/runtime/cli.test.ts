import { describe, expect, test } from "bun:test";
import { parseCli } from "./cli.ts";

describe("parseCli", () => {
  test("invalid — empty argv", () => {
    const result = parseCli([]);
    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.error).toContain("Unknown command");
    }
  });

  test("invalid — unknown command", () => {
    const result = parseCli(["watch"]);
    expect(result.kind).toBe("invalid");
  });

  test("invalid — missing --source", () => {
    const result = parseCli(["build", "--output", "dist"]);
    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.error).toContain("Missing required --source or --output");
    }
  });

  test("invalid — missing --output", () => {
    const result = parseCli(["build", "--source", "pages"]);
    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.error).toContain("Missing required --source or --output");
    }
  });

  test("build — minimal required args", () => {
    const result = parseCli(["build", "--source", "src", "--output", "out"]);
    expect(result.kind).toBe("build");
    if (result.kind === "build") {
      expect(result.args.source).toBe("src");
      expect(result.args.output).toBe("out");
      expect(result.args.layouts).toBe("");
      expect(result.args.public).toBe("");
      expect(result.args.port).toBe("3000");
    }
  });

  test("build — with layouts", () => {
    const result = parseCli([
      "build",
      "--source",
      "src",
      "--output",
      "out",
      "--layouts",
      "templates",
    ]);
    expect(result.kind).toBe("build");
    if (result.kind === "build") {
      expect(result.args.layouts).toBe("templates");
    }
  });

  test("build — with public", () => {
    const result = parseCli([
      "build",
      "--source",
      "src",
      "--output",
      "out",
      "--public",
      "static",
    ]);
    expect(result.kind).toBe("build");
    if (result.kind === "build") {
      expect(result.args.public).toBe("static");
    }
  });

  test("build — with both layouts and public", () => {
    const result = parseCli([
      "build",
      "--source",
      "src",
      "--output",
      "out",
      "--layouts",
      "layouts",
      "--public",
      "public",
    ]);
    expect(result.kind).toBe("build");
    if (result.kind === "build") {
      expect(result.args.layouts).toBe("layouts");
      expect(result.args.public).toBe("public");
    }
  });

  test("dev — minimal required args with --dev flag", () => {
    const result = parseCli([
      "build",
      "--source",
      "src",
      "--output",
      "out",
      "--dev",
    ]);
    expect(result.kind).toBe("dev");
    if (result.kind === "dev") {
      expect(result.args.source).toBe("src");
      expect(result.args.output).toBe("out");
      expect(result.args.port).toBe("3000");
    }
  });

  test("dev — with explicit port", () => {
    const result = parseCli([
      "build",
      "--source",
      "src",
      "--output",
      "out",
      "--dev",
      "--port",
      "8080",
    ]);
    expect(result.kind).toBe("dev");
    if (result.kind === "dev") {
      expect(result.args.port).toBe("8080");
    }
  });

  test("dev — full args with layouts, public, port", () => {
    const result = parseCli([
      "build",
      "--source",
      "example/pages",
      "--output",
      "example/dist",
      "--layouts",
      "example/layouts",
      "--public",
      "example/public",
      "--dev",
      "--port",
      "4000",
    ]);
    expect(result.kind).toBe("dev");
    if (result.kind === "dev") {
      expect(result.args.source).toBe("example/pages");
      expect(result.args.output).toBe("example/dist");
      expect(result.args.layouts).toBe("example/layouts");
      expect(result.args.public).toBe("example/public");
      expect(result.args.port).toBe("4000");
    }
  });

  test("handles flags in any order", () => {
    const result = parseCli([
      "build",
      "--dev",
      "--port",
      "5000",
      "--source",
      "pages",
      "--layouts",
      "layouts",
      "--output",
      "dist",
      "--public",
      "static",
    ]);
    expect(result.kind).toBe("dev");
    if (result.kind === "dev") {
      expect(result.args.source).toBe("pages");
      expect(result.args.output).toBe("dist");
      expect(result.args.port).toBe("5000");
    }
  });

  test("includes usage string on invalid", () => {
    const result = parseCli(["run"]);
    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.usage).toContain("--source");
      expect(result.usage).toContain("--output");
    }
  });
});
