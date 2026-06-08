import { describe, expect, test } from "bun:test";
import { CommandLineRuntimeAdapter } from "./command_line_runtime_adapter.ts";

function createEffects() {
  const logs: string[] = [];
  const errors: string[] = [];
  let exitCode: number | undefined;

  return {
    effects: {
      log: (message: string) => logs.push(message),
      error: (message: string) => errors.push(message),
      setExitCode: (code: number) => {
        exitCode = code;
      },
    },
    logs,
    errors,
    get exitCode() {
      return exitCode;
    },
  };
}

describe("CommandLineRuntimeAdapter", () => {
  test("ready prints a non-empty message", async () => {
    const fake = createEffects();
    const Runtime = new CommandLineRuntimeAdapter(fake.effects);

    await Runtime.ready({ invocation: "inv-1", message: "Server ready." });

    expect(fake.logs).toEqual(["Server ready."]);
    expect(fake.errors).toEqual([]);
  });

  test("notice prints error-level messages to stderr", async () => {
    const fake = createEffects();
    const Runtime = new CommandLineRuntimeAdapter(fake.effects);

    await Runtime.notice({
      invocation: "inv-1",
      message: "Build failed.",
      level: "error",
    });

    expect(fake.logs).toEqual([]);
    expect(fake.errors).toEqual(["Build failed."]);
  });

  test("succeed prints optional message and sets exit code to zero", async () => {
    const fake = createEffects();
    const Runtime = new CommandLineRuntimeAdapter(fake.effects);

    await Runtime.succeed({ invocation: "inv-1", message: "Build complete." });

    expect(fake.logs).toEqual(["Build complete."]);
    expect(fake.exitCode).toBe(0);
  });

  test("fail prints usage and message to stderr and sets exit code to one", async () => {
    const fake = createEffects();
    const Runtime = new CommandLineRuntimeAdapter(fake.effects);

    await Runtime.fail({
      invocation: "inv-1",
      usage: "Usage",
      message: "Missing args",
    });

    expect(fake.errors).toEqual(["Usage", "Missing args"]);
    expect(fake.exitCode).toBe(1);
  });
});
