import { beforeEach, describe, expect, test } from "bun:test";
import CommandLineConcept from "./CommandLineConcept.ts";

let CommandLine: CommandLineConcept;

beforeEach(() => {
  CommandLine = new CommandLineConcept();
});

describe("CommandLine", () => {
  test("invoke creates a PENDING invocation and returns it with argv", async () => {
    const result = await CommandLine.invoke({
      argv: ["build", "--source", "src"],
    });
    expect(typeof result.invocation).toBe("string");
    expect(result.argv).toEqual(["build", "--source", "src"]);

    const [doc] = await CommandLine._getInvocation({
      invocation: result.invocation,
    });
    expect(doc.status).toBe("PENDING");
  });

  test("waitFor records operation and mode and returns command for correlation", async () => {
    const { invocation } = await CommandLine.invoke({ argv: ["build"] });
    const op = "cmd-1" as never;

    const result = await CommandLine.waitFor({
      invocation,
      operation: op,
      mode: "complete",
    });
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.invocation).toBe(invocation);
      expect(result.command).toBe(op);
    }

    const [doc] = await CommandLine._getInvocation({ invocation });
    expect(doc.waitingFor).toBe(op);
    expect(doc.mode).toBe("complete");
  });

  test("waitFor returns error for nonexistent invocation", async () => {
    const result = await CommandLine.waitFor({
      invocation: "nope" as never,
      operation: "cmd" as never,
      mode: "complete",
    });
    expect("error" in result).toBe(true);
  });

  test("ready transitions to READY and prints message", async () => {
    const { invocation } = await CommandLine.invoke({ argv: ["build"] });

    const result = await CommandLine.ready({
      invocation,
      message: "Server ready.",
    });
    expect("error" in result).toBe(false);

    const [doc] = await CommandLine._getInvocation({ invocation });
    expect(doc.status).toBe("READY");
    expect(doc.message).toBe("Server ready.");
  });

  test("succeed transitions to SUCCEEDED and sets exitCode", async () => {
    const { invocation } = await CommandLine.invoke({ argv: ["build"] });

    const result = await CommandLine.succeed({
      invocation,
      message: "Build done.",
    });
    expect("error" in result).toBe(false);

    const [doc] = await CommandLine._getInvocation({ invocation });
    expect(doc.status).toBe("SUCCEEDED");
    expect(doc.message).toBe("Build done.");
    expect(process.exitCode as number).toBe(0);
  });

  test("fail transitions to FAILED, prints usage+error, and sets exitCode", async () => {
    const { invocation } = await CommandLine.invoke({ argv: ["build"] });

    const result = await CommandLine.fail({
      invocation,
      error: "Something went wrong",
      usage: "Usage: ...",
    });
    expect("error" in result).toBe(false);

    const [doc] = await CommandLine._getInvocation({ invocation });
    expect(doc.status).toBe("FAILED");
    expect(doc.error).toBe("Something went wrong");
    expect(doc.usage).toBe("Usage: ...");
    expect(process.exitCode as number).toBe(1);
  });

  test("succeed on already terminal invocation returns error", async () => {
    const { invocation } = await CommandLine.invoke({ argv: ["build"] });
    await CommandLine.succeed({ invocation });

    const result = await CommandLine.succeed({ invocation });
    expect("error" in result).toBe(true);
  });

  test("notice prints and stores message without changing status", async () => {
    const { invocation } = await CommandLine.invoke({ argv: ["build"] });

    const result = await CommandLine.notice({
      invocation,
      message: "Change detected.",
    });
    expect("error" in result).toBe(false);

    const [doc] = await CommandLine._getInvocation({ invocation });
    expect(doc.status).toBe("PENDING");
    expect(doc.message).toBe("Change detected.");
  });

  test("notice with level error prints to stderr", async () => {
    const { invocation } = await CommandLine.invoke({ argv: ["build"] });

    const result = await CommandLine.notice({
      invocation,
      message: "Build error",
      level: "error",
    });
    expect("error" in result).toBe(false);
  });

  test("_getByOperation returns invocation waiting for the operation", async () => {
    const { invocation } = await CommandLine.invoke({ argv: ["build"] });
    const op = "cmd-1" as never;
    await CommandLine.waitFor({ invocation, operation: op, mode: "complete" });

    const rows = await CommandLine._getByOperation({ operation: op });
    expect(rows).toHaveLength(1);
    expect(rows[0].invocation).toBe(invocation);
  });

  test("_getByOperation returns empty for unknown operation", async () => {
    const rows = await CommandLine._getByOperation({
      operation: "nope" as never,
    });
    expect(rows).toHaveLength(0);
  });

  test("principle: CLI invocation lifecycle with waitFor → succeed", async () => {
    const { invocation } = await CommandLine.invoke({
      argv: ["build", "--source", "src", "--output", "out"],
    });
    const op = "cmd-build" as never;

    await CommandLine.waitFor({ invocation, operation: op, mode: "complete" });

    // Verify operation is tracked
    const rows = await CommandLine._getByOperation({ operation: op });
    expect(rows).toHaveLength(1);

    await CommandLine.succeed({ invocation, message: "Build done." });

    const [doc] = await CommandLine._getInvocation({ invocation });
    expect(doc.status).toBe("SUCCEEDED");
  });

  test("principle: CLI invocation lifecycle with waitFor → fail", async () => {
    const { invocation } = await CommandLine.invoke({ argv: ["build"] });
    const op = "cmd-fail" as never;

    await CommandLine.waitFor({ invocation, operation: op, mode: "complete" });
    await CommandLine.fail({
      invocation,
      error: "Build error",
      usage: "Usage",
    });

    const [doc] = await CommandLine._getInvocation({ invocation });
    expect(doc.status).toBe("FAILED");
    expect(doc.error).toBe("Build error");
  });
});
