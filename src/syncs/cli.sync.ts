/**
 * CLI syncs — translate `CommandLine.invoke` into `Commanding.issue`
 * and wire the invocation lifecycle to command completion.
 */

import type { AppConcepts } from "@concepts";
import { actions, type Sync } from "@engine";
import { parseCli } from "../runtime/cli.ts";

export function createCliSyncs({
  CommandLine,
  Commanding,
}: Pick<AppConcepts, "CommandLine" | "Commanding">) {
  const CliInvalid: Sync = ({ invocation, argv, error, usage }) => ({
    when: actions([CommandLine.invoke, {}, { invocation, argv }]),
    where: (frames) =>
      frames
        .filter((frame) => {
          const raw = frame[argv] as string[];
          return parseCli(raw).kind === "invalid";
        })
        .map((frame) => {
          const raw = frame[argv] as string[];
          const parsed = parseCli(raw) as {
            kind: "invalid";
            error: string;
            usage: string;
          };
          return { ...frame, [error]: parsed.error, [usage]: parsed.usage };
        }),
    then: actions([CommandLine.fail, { invocation, error, usage }]),
  });

  const CliInvokeBuild: Sync = ({ invocation, argv, args }) => ({
    when: actions([CommandLine.invoke, {}, { invocation, argv }]),
    where: (frames) =>
      frames
        .filter((frame) => {
          const raw = frame[argv] as string[];
          return parseCli(raw).kind === "build";
        })
        .map((frame) => {
          const raw = frame[argv] as string[];
          const parsed = parseCli(raw) as {
            kind: "build";
            args: Record<string, string>;
          };
          return { ...frame, [args]: parsed.args };
        }),
    then: actions([Commanding.issue, { name: "build", args }]),
  });

  const CliInvokeDev: Sync = ({ invocation, argv, args }) => ({
    when: actions([CommandLine.invoke, {}, { invocation, argv }]),
    where: (frames) =>
      frames
        .filter((frame) => {
          const raw = frame[argv] as string[];
          return parseCli(raw).kind === "dev";
        })
        .map((frame) => {
          const raw = frame[argv] as string[];
          const parsed = parseCli(raw) as {
            kind: "dev";
            args: Record<string, string>;
          };
          return { ...frame, [args]: parsed.args };
        }),
    then: actions([Commanding.issue, { name: "dev", args }]),
  });

  const CliWaitBuildComplete: Sync = ({ invocation, command, argv }) => ({
    when: actions(
      [CommandLine.invoke, {}, { invocation, argv }],
      [Commanding.issue, { name: "build" }, { command }],
    ),
    where: (frames) =>
      frames.filter((frame) => {
        const raw = frame[argv] as string[];
        return parseCli(raw).kind === "build";
      }),
    then: actions([
      CommandLine.waitFor,
      { invocation, operation: command, mode: "complete" },
    ]),
  });

  const CliWaitDevReady: Sync = ({ invocation, command, argv }) => ({
    when: actions(
      [CommandLine.invoke, {}, { invocation, argv }],
      [Commanding.issue, { name: "dev" }, { command }],
    ),
    where: (frames) =>
      frames.filter((frame) => {
        const raw = frame[argv] as string[];
        return parseCli(raw).kind === "dev";
      }),
    then: actions([
      CommandLine.waitFor,
      { invocation, operation: command, mode: "ready" },
    ]),
  });

  const WaitForCompleteSucceed: Sync = ({ invocation, command }) => ({
    when: actions(
      [CommandLine.waitFor, { mode: "complete" }, { invocation, command }],
      [Commanding.succeed, { command }, { command }],
    ),
    then: actions([
      CommandLine.succeed,
      { invocation, message: "Build complete." },
    ]),
  });

  const WaitForCompleteFail: Sync = ({ invocation, command, buildError }) => ({
    when: actions(
      [CommandLine.waitFor, { mode: "complete" }, { invocation, command }],
      [Commanding.fail, { command, error: buildError }, { command }],
    ),
    then: actions([CommandLine.fail, { invocation, error: buildError }]),
  });

  const WaitForReadySucceed: Sync = ({ invocation, command }) => ({
    when: actions(
      [CommandLine.waitFor, { mode: "ready" }, { invocation, command }],
      [Commanding.succeed, { command }, { command }],
    ),
    then: actions([CommandLine.ready, { invocation }]),
  });

  const WaitForReadyFail: Sync = ({
    invocation,
    command,
    commandError,
    mode,
  }) => ({
    when: actions([
      Commanding.fail,
      { command, error: commandError },
      { command },
    ]),
    where: async (frames) => {
      let enriched = await frames.query(
        CommandLine._getByOperation,
        { operation: command },
        { invocation },
      );
      enriched = await enriched.query(
        CommandLine._getInvocation,
        { invocation },
        { mode },
      );
      return enriched.filter((frame) => frame[mode] === "ready");
    },
    then: actions([CommandLine.fail, { invocation, error: commandError }]),
  });

  return {
    CliInvalid,
    CliInvokeBuild,
    CliInvokeDev,
    CliWaitBuildComplete,
    CliWaitDevReady,
    WaitForCompleteSucceed,
    WaitForCompleteFail,
    WaitForReadySucceed,
    WaitForReadyFail,
  };
}
