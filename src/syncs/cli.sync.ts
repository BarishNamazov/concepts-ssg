/**
 * CLI syncs — translate `CommandLine.invoke` into `Building.request`
 * and wire the invocation lifecycle to build completion.
 */

import type { AppConcepts } from "@concepts";
import { actions, type Sync } from "@engine";
import { parseCli } from "../runtime/cli.ts";

export function createCliSyncs({
  CommandLine,
  Building,
}: Pick<AppConcepts, "CommandLine" | "Building">) {
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
    then: actions([Building.request, { config: args, kind: "manual" }]),
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
    then: actions([
      Building.request,
      { config: args, kind: "dev-start", context: invocation },
    ]),
  });

  const CliWaitBuildComplete: Sync = ({ invocation, build, kind, argv }) => ({
    when: actions(
      [CommandLine.invoke, {}, { invocation, argv }],
      [Building.start, {}, { build, kind }],
    ),
    where: (frames) =>
      frames.filter((frame) => {
        const raw = frame[argv] as string[];
        const k = frame[kind] as string;
        return parseCli(raw).kind === "build" && k === "manual";
      }),
    then: actions([
      CommandLine.waitFor,
      { invocation, operation: build, mode: "complete" },
    ]),
  });

  const CliWaitDevReady: Sync = ({ invocation, build, kind, argv }) => ({
    when: actions(
      [CommandLine.invoke, {}, { invocation, argv }],
      [Building.start, {}, { build, kind }],
    ),
    where: (frames) =>
      frames.filter((frame) => {
        const raw = frame[argv] as string[];
        const k = frame[kind] as string;
        return parseCli(raw).kind === "dev" && k === "dev-start";
      }),
    then: actions([
      CommandLine.waitFor,
      { invocation, operation: build, mode: "ready" },
    ]),
  });

  const WaitForCompleteSucceed: Sync = ({ invocation, build }) => ({
    when: actions(
      [
        CommandLine.waitFor,
        { mode: "complete" },
        { invocation, command: build },
      ],
      [Building.complete, { build }, { build }],
    ),
    then: actions([
      CommandLine.succeed,
      { invocation, message: "Build complete." },
    ]),
  });

  const WaitForCompleteFail: Sync = ({ invocation, build, buildError }) => ({
    when: actions(
      [
        CommandLine.waitFor,
        { mode: "complete" },
        { invocation, command: build },
      ],
      [Building.fail, { build }, { build, error: buildError }],
    ),
    then: actions([CommandLine.fail, { invocation, error: buildError }]),
  });

  return {
    CliInvalid,
    CliInvokeBuild,
    CliInvokeDev,
    CliWaitBuildComplete,
    CliWaitDevReady,
    WaitForCompleteSucceed,
    WaitForCompleteFail,
  };
}
