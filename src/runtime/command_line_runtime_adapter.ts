export interface CommandLineEffects {
  log(message: string): void;
  error(message: string): void;
  setExitCode(code: number): void;
}

const defaultEffects: CommandLineEffects = {
  log(message) {
    console.log(message);
  },
  error(message) {
    console.error(message);
  },
  setExitCode(code) {
    process.exitCode = code;
  },
};

/**
 * Runtime adapter for command-line process effects.
 *
 * CommandLine remains pure state; this boundary owns stdout, stderr, and the
 * process exit code.
 */
export class CommandLineRuntimeAdapter {
  constructor(private readonly effects: CommandLineEffects = defaultEffects) {}

  /**
   * ready ({ invocation, message }): ({ invocation })
   *
   * **requires** true
   *
   * **effects** prints `message` to stdout when present
   */
  async ready({
    invocation,
    message,
  }: {
    invocation: string;
    message: string;
  }): Promise<{ invocation: string }> {
    if (message !== "") this.effects.log(message);
    return { invocation };
  }

  /**
   * notice ({ invocation, message, level }): ({ invocation })
   *
   * **requires** true
   *
   * **effects** prints `message` to stdout or stderr according to `level`
   */
  async notice({
    invocation,
    message,
    level,
  }: {
    invocation: string;
    message: string;
    level: string;
  }): Promise<{ invocation: string }> {
    if (level === "error") {
      this.effects.error(message);
    } else {
      this.effects.log(message);
    }
    return { invocation };
  }

  /**
   * succeed ({ invocation, message }): ({ invocation })
   *
   * **requires** true
   *
   * **effects** prints `message` when present and sets process exit code to 0
   */
  async succeed({
    invocation,
    message,
  }: {
    invocation: string;
    message: string;
  }): Promise<{ invocation: string }> {
    if (message !== "") this.effects.log(message);
    this.effects.setExitCode(0);
    return { invocation };
  }

  /**
   * fail ({ invocation, message, usage }): ({ invocation })
   *
   * **requires** true
   *
   * **effects** prints usage and error to stderr and sets process exit code to 1
   */
  async fail({
    invocation,
    message,
    usage,
  }: {
    invocation: string;
    message: string;
    usage: string;
  }): Promise<{ invocation: string }> {
    if (usage !== "") this.effects.error(usage);
    this.effects.error(message);
    this.effects.setExitCode(1);
    return { invocation };
  }
}
