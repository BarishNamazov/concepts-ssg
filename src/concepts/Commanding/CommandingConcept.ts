import { freshID } from "@utils/id.ts";
import type { ID } from "@utils/types.ts";

type Command = ID;

interface CommandDoc {
  _id: Command;
  name: string;
  args: Record<string, string>;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  result?: string;
  error?: string;
}

/**
 * Commanding concept — generic command lifecycle.
 *
 * **purpose** let a caller initiate an operation and determine whether it
 *   completed
 *
 * **principle** after a caller issues a command, the command is assigned an
 *   identity; when processing succeeds the command becomes succeeded with a
 *   result, and when processing cannot complete it becomes failed with an
 *   explanation
 *
 * **state**
 *   a set of Commands with
 *     a name String
 *     an arguments record
 *     a status of PENDING or SUCCEEDED or FAILED
 *     an optional result String
 *     an optional error String
 */
export default class CommandingConcept {
  private commands = new Map<Command, CommandDoc>();

  /**
   * issue ({ name, args }): ({ command, name })
   *
   * **requires** true
   *
   * **effects** creates a new command in PENDING status and returns its identity
   */
  async issue({
    name,
    args,
  }: {
    name: string;
    args: Record<string, string>;
  }): Promise<{ command: Command; name: string }> {
    const id = freshID();
    this.commands.set(id, { _id: id, name, args, status: "PENDING" });
    return { command: id, name };
  }

  /**
   * succeed ({ command, result? }): ({ command })
   *
   * **requires** `command` is an existing command in PENDING status
   *
   * **effects** marks the command as SUCCEEDED with an optional result
   */
  async succeed({
    command,
    result,
  }: {
    command: Command;
    result?: string;
  }): Promise<{ command: Command } | { error: string }> {
    const doc = this.commands.get(command);
    if (!doc) return { error: `Command not found: ${command}` };
    if (doc.status !== "PENDING") {
      return { error: `Command is not pending (${doc.status}): ${command}` };
    }
    doc.status = "SUCCEEDED";
    doc.result = result;
    return { command };
  }

  /**
   * fail ({ command, error }): ({ command })
   *
   * **requires** `command` is an existing command in PENDING status
   *
   * **effects** marks the command as FAILED with an error explanation
   */
  async fail({
    command,
    error,
  }: {
    command: Command;
    error: string;
  }): Promise<{ command: Command } | { error: string }> {
    const doc = this.commands.get(command);
    if (!doc) return { error: `Command not found: ${command}` };
    if (doc.status !== "PENDING") {
      return { error: `Command is not pending (${doc.status}): ${command}` };
    }
    doc.status = "FAILED";
    doc.error = error;
    return { command };
  }

  /**
   * _get ({ command }): ({ name, args, status, result?, error? })
   *
   * **requires** `command` is an existing command
   *
   * **effects** returns the command's name, arguments, status, and optional
   *   result or error
   */
  async _get({ command }: { command: Command }): Promise<
    {
      name: string;
      args: Record<string, string>;
      status: string;
      result?: string;
      error?: string;
    }[]
  > {
    const doc = this.commands.get(command);
    if (!doc) return [];
    return [
      {
        name: doc.name,
        args: doc.args,
        status: doc.status,
        result: doc.result,
        error: doc.error,
      },
    ];
  }
}
