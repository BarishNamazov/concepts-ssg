import { describe, expect, test } from "bun:test";
import { resolveRoot, safeJoin } from "./path_guard.ts";

describe("path_guard", () => {
  describe("resolveRoot", () => {
    test("resolves a relative path to absolute", () => {
      const result = resolveRoot(".");
      expect(result).toBe(process.cwd());
    });

    test("resolves a path with .. components", () => {
      const result = resolveRoot("/foo/bar/../baz");
      expect(result).toBe("/foo/baz");
    });

    test("normalizes trailing slash", () => {
      const result = resolveRoot("/foo/bar/");
      expect(result).toBe("/foo/bar");
    });
  });

  describe("safeJoin", () => {
    test("joins a simple relative path within root", () => {
      const result = safeJoin("/home/user/out", "index.html");
      expect(typeof result).toBe("string");
      if (typeof result === "string") {
        expect(result).toBe("/home/user/out/index.html");
      }
    });

    test("joins a nested relative path within root", () => {
      const result = safeJoin("/home/user/out", "blog/post.html");
      expect(typeof result).toBe("string");
      if (typeof result === "string") {
        expect(result).toBe("/home/user/out/blog/post.html");
      }
    });

    test("rejects path that escapes up via ..", () => {
      const result = safeJoin("/home/user/out", "../../etc/passwd");
      expect(typeof result).toBe("object");
      if (typeof result === "object") {
        expect("error" in result).toBe(true);
      }
    });

    test("rejects absolute path as relative argument", () => {
      const result = safeJoin("/home/user/out", "/etc/passwd");
      expect(typeof result).toBe("object");
      if (typeof result === "object") {
        expect("error" in result).toBe(true);
      }
    });

    test("allows path that resolves within root via .. that goes back in", () => {
      const result = safeJoin("/home/user/out", "blog/../../out/index.html");
      expect(typeof result).toBe("string");
      if (typeof result === "string") {
        expect(result).toBe("/home/user/out/index.html");
      }
    });

    test("rejects path that escapes with leading .. after normalization", () => {
      const result = safeJoin("/home/user", "../etc");
      expect(typeof result).toBe("object");
      if (typeof result === "object") {
        expect("error" in result).toBe(true);
      }
    });

    test("handles relative root", () => {
      const result = safeJoin(".", "foo/bar.txt");
      expect(typeof result).toBe("string");
      if (typeof result === "string") {
        expect(result).toBe(`${process.cwd()}/foo/bar.txt`);
      }
    });
  });
});
