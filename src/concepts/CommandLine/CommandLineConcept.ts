import { freshID } from "@utils/id.ts";
import type { ID } from "@utils/types.ts";

type Invocation = ID;
type Operation = ID;

interface InvocationDoc {
  _id: Invocation;
  argv: string[];
  status: "PENDING" | "READY" | "SUCCEEDED" | "FAILED";
  message?: string;
  error?: string;
  usage?: string;
  waitingFor?: Operation;
  mode?: string;
}

/**
 * CommandLine [Operation]
 *
 * **purpose** represent a command-line invocation and communicate its
 *   lifecycle to the human operator
 *
 * **principle** after a caller invokes the CLI with arguments, the invocation
 *   is created in PENDING status; when the associated operation completes the
 *   invocation transitions to SUCCEEDED, and when it fails the invocation
 *   transitions to FAILED with the error and optional usage printed
 *
 * **state**
 *   a set of Invocations with
 *     an argv seq of String
 *     a status of PENDING or READY or SUCCEEDED or FAILED
 *     an optional message String
 *     an optional error String
 *     an optional waitingFor Operation
 *     an optional mode String
 */
export default class CommandLineConcept {
  private invocations = new Map<Invocation, InvocationDoc>();

  /**
   * invoke ({ argv }): ({ invocation, argv })
   *
   * **requires** true
   *
   * **effects** creates a new invocation in PENDING status and returns its id
   *   together with the original argv
   */
  async invoke({
    argv,
  }: {
    argv: string[];
  }): Promise<{ invocation: Invocation; argv: string[] }> {
    const id = freshID();
    this.invocations.set(id, {
      _id: id,
      argv,
      status: "PENDING",
    });
    return { invocation: id, argv };
  }

  /**
   * waitFor ({ invocation, operation, mode }): ({ invocation, command })
   *
   * **requires** `invocation` is an existing invocation in PENDING status
   *
   * **effects** records the operation this invocation is waiting for and the
   *   wait mode ("complete" or "ready"); returns the invocation id and the
   *   operation id as `command` so it can be correlated in syncs
   */
  async waitFor({
    invocation,
    operation,
    mode,
  }: {
    invocation: Invocation;
    operation: Operation;
    mode: string;
  }): Promise<
    { invocation: Invocation; command: Operation } | { error: string }
  > {
    const doc = this.invocations.get(invocation);
    if (!doc) return { error: `Invocation not found: ${invocation}` };
    if (doc.status !== "PENDING") {
      return { error: `Invocation not pending: ${invocation}` };
    }
    doc.waitingFor = operation;
    doc.mode = mode;
    return { invocation, command: operation };
  }

  /**
   * ready ({ invocation, message? }): ({ invocation })
   *
   * **requires** `invocation` exists and is not already SUCCEEDED or FAILED
   *
   * **effects** marks the invocation as READY and prints a message to stdout
   */
  async ready({
    invocation,
    message,
  }: {
    invocation: Invocation;
    message?: string;
  }): Promise<{ invocation: Invocation } | { error: string }> {
    const doc = this.invocations.get(invocation);
    if (!doc) return { error: `Invocation not found: ${invocation}` };
    if (doc.status === "SUCCEEDED" || doc.status === "FAILED") {
      return { error: `Invocation already terminal: ${invocation}` };
    }
    doc.status = "READY";
    if (message) doc.message = message;
    if (message) console.log(message);
    return { invocation };
  }

  /**
   * notice ({ invocation, message, level }): ({ invocation })
   *
   * **requires** `invocation` exists
   *
   * **effects** prints a message at the given level (info by default) and
   *   stores it on the invocation; does not change status
   */
  async notice({
    invocation,
    message,
    level,
  }: {
    invocation: Invocation;
    message: string;
    level?: string;
  }): Promise<{ invocation: Invocation } | { error: string }> {
    const doc = this.invocations.get(invocation);
    if (!doc) return { error: `Invocation not found: ${invocation}` };
    doc.message = message;
    if (level === "error") {
      console.error(message);
    } else {
      console.log(message);
    }
    return { invocation };
  }

  /**
   * succeed ({ invocation, message? }): ({ invocation })
   *
   * **requires** `invocation` exists and is not already SUCCEEDED or FAILED
   *
   * **effects** marks the invocation as SUCCEEDED, prints a message to stdout,
   *   and sets process.exitCode to 0
   */
  async succeed({
    invocation,
    message,
  }: {
    invocation: Invocation;
    message?: string;
  }): Promise<{ invocation: Invocation } | { error: string }> {
    const doc = this.invocations.get(invocation);
    if (!doc) return { error: `Invocation not found: ${invocation}` };
    if (doc.status === "SUCCEEDED" || doc.status === "FAILED") {
      return { error: `Invocation already terminal: ${invocation}` };
    }
    doc.status = "SUCCEEDED";
    if (message) doc.message = message;
    if (message) console.log(message);
    process.exitCode = 0;
    return { invocation };
  }

  /**
   * fail ({ invocation, error, usage? }): ({ invocation })
   *
   * **requires** `invocation` exists and is not already SUCCEEDED or FAILED
   *
   * **effects** marks the invocation as FAILED, prints usage and error to
   *   stderr, and sets process.exitCode to 1
   */
  async fail({
    invocation,
    error: errorMsg,
    usage,
  }: {
    invocation: Invocation;
    error: string;
    usage?: string;
  }): Promise<{ invocation: Invocation } | { error: string }> {
    const doc = this.invocations.get(invocation);
    if (!doc) return { error: `Invocation not found: ${invocation}` };
    if (doc.status === "SUCCEEDED" || doc.status === "FAILED") {
      return { error: `Invocation already terminal: ${invocation}` };
    }
    doc.status = "FAILED";
    doc.error = errorMsg;
    if (usage) doc.usage = usage;
    if (usage) console.error(usage);
    console.error(errorMsg);
    process.exitCode = 1;
    return { invocation };
  }

  /**
   * _getByOperation ({ operation }): ({ invocation })
   *
   * **requires** true
   *
   * **effects** returns the invocation whose `waitingFor` field equals the
   *   given operation, or an empty array if none
   */
  async _getByOperation({
    operation,
  }: {
    operation: Operation;
  }): Promise<{ invocation: Invocation }[]> {
    for (const doc of this.invocations.values()) {
      if (doc.waitingFor === operation) {
        return [{ invocation: doc._id }];
      }
    }
    return [];
  }

  /**
   * _getInvocation ({ invocation }): ({ argv, status, waitingFor, mode, message, error, usage })
   *
   * **requires** `invocation` exists
   *
   * **effects** returns the full state of the invocation
   */
  async _getInvocation({ invocation }: { invocation: Invocation }): Promise<
    {
      argv: string[];
      status: string;
      waitingFor?: Operation;
      mode?: string;
      message?: string;
      error?: string;
      usage?: string;
    }[]
  > {
    const doc = this.invocations.get(invocation);
    if (!doc) return [];
    return [
      {
        argv: doc.argv,
        status: doc.status,
        waitingFor: doc.waitingFor,
        mode: doc.mode,
        message: doc.message,
        error: doc.error,
        usage: doc.usage,
      },
    ];
  }
}
