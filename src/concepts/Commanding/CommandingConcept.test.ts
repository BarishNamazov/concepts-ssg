import { beforeEach, describe, expect, test } from "bun:test";
import CommandingConcept from "./CommandingConcept.ts";

let Commanding: CommandingConcept;

beforeEach(() => {
  Commanding = new CommandingConcept();
});

describe("Commanding", () => {
  test("issue creates a pending command with identity", async () => {
    const result = await Commanding.issue({
      name: "build",
      args: { source: "pages", output: "dist" },
    });
    expect(result.name).toBe("build");
    expect(typeof result.command).toBe("string");
    expect(result.command.length).toBeGreaterThan(0);
  });

  test("issue creates distinct command ids", async () => {
    const r1 = await Commanding.issue({
      name: "build",
      args: { source: "pages", output: "dist" },
    });
    const r2 = await Commanding.issue({
      name: "build",
      args: { source: "other", output: "out" },
    });
    expect(r1.command).not.toBe(r2.command);
  });

  test("succeed marks command as SUCCEEDED", async () => {
    const { command } = await Commanding.issue({
      name: "build",
      args: { source: "src" },
    });
    await Commanding.succeed({ command, result: "built 5 pages" });
    const [cmd] = await Commanding._get({ command });
    expect(cmd.status).toBe("SUCCEEDED");
    expect(cmd.result).toBe("built 5 pages");
  });

  test("fail marks command as FAILED", async () => {
    const { command } = await Commanding.issue({
      name: "build",
      args: { source: "src" },
    });
    await Commanding.fail({ command, error: "missing source" });
    const [cmd] = await Commanding._get({ command });
    expect(cmd.status).toBe("FAILED");
    expect(cmd.error).toBe("missing source");
  });

  test("cannot succeed a command that is already failed", async () => {
    const { command } = await Commanding.issue({
      name: "build",
      args: { source: "src" },
    });
    await Commanding.fail({ command, error: "bad" });
    const result = await Commanding.succeed({ command });
    expect("error" in result).toBe(true);
  });

  test("cannot fail a command that is already succeeded", async () => {
    const { command } = await Commanding.issue({
      name: "build",
      args: { source: "src" },
    });
    await Commanding.succeed({ command });
    const result = await Commanding.fail({ command, error: "too late" });
    expect("error" in result).toBe(true);
  });

  test("_get returns empty for unknown command", async () => {
    const result = await Commanding._get({ command: "nonexistent" as never });
    expect(result).toEqual([]);
  });

  test("principle: full issue → succeed → query lifecycle", async () => {
    const { command } = await Commanding.issue({
      name: "build",
      args: { source: "pages", output: "dist" },
    });

    let [cmd] = await Commanding._get({ command });
    expect(cmd.name).toBe("build");
    expect(cmd.status).toBe("PENDING");
    expect(cmd.args).toEqual({ source: "pages", output: "dist" });

    await Commanding.succeed({ command, result: "ok" });

    [cmd] = await Commanding._get({ command });
    expect(cmd.status).toBe("SUCCEEDED");
    expect(cmd.result).toBe("ok");
  });
});
