/**
 * Dev-mode syncs — static declarations for dev server startup, file watching,
 * rebuild on change, and live reload.
 *
 * All syncs are registered statically; no conditional registration.
 */

import type { AppConcepts } from "@concepts";
import { actions, type Sync } from "@engine";

export function createDevSyncs({
  Coalescing,
  Commanding,
  CommandLine,
  Serving,
  Watching,
}: Pick<
  AppConcepts,
  "Coalescing" | "Commanding" | "CommandLine" | "Serving" | "Watching"
>) {
  /**
   * Dev startup: when a "dev" command is issued, start the server, watch the
   * source directory, and kick off the initial build.
   */
  const DevStart: Sync = ({ command, source, output, port, args }) => ({
    when: actions([Commanding.issue, { name: "dev", args }, { command }]),
    where: (frames) =>
      frames.map((frame) => {
        const cmdArgs = frame[args] as Record<string, string>;
        return {
          ...frame,
          [source]: cmdArgs.source,
          [output]: cmdArgs.output,
          [port]: parseInt(cmdArgs.port ?? "3000", 10),
        };
      }),
    then: actions(
      [Serving.start, { port, root: output }],
      [Watching.start, { subject: source, context: command }],
      [Coalescing.request, { context: command, kind: "initial" }],
    ),
  });

  /**
   * A coalesced request that starts work issues an actual build command.
   */
  const CoalescedRequestStartsBuild: Sync = ({
    devCmd,
    args,
    kind,
    buildArgs,
    started,
  }) => ({
    when: actions([Coalescing.request, {}, { context: devCmd, kind, started }]),
    where: async (frames) => {
      frames = await frames.query(
        Commanding._get,
        { command: devCmd },
        { args },
      );
      return frames.map((frame) => ({
        ...frame,
        [buildArgs]: {
          ...(frame[args] as Record<string, string>),
          _devContext: String(frame[devCmd]),
          _devKind: String(frame[kind]),
        },
      }));
    },
    then: actions([Commanding.issue, { name: "build", args: buildArgs }]),
  });

  /**
   * Finishing an active build can start one queued follow-up build.
   */
  const CoalescedFollowUpStartsBuild: Sync = ({
    devCmd,
    args,
    kind,
    buildArgs,
    started,
  }) => ({
    when: actions([Coalescing.finish, {}, { context: devCmd, kind, started }]),
    where: async (frames) => {
      frames = await frames.query(
        Commanding._get,
        { command: devCmd },
        { args },
      );
      return frames.map((frame) => ({
        ...frame,
        [buildArgs]: {
          ...(frame[args] as Record<string, string>),
          _devContext: String(frame[devCmd]),
          _devKind: String(frame[kind]),
        },
      }));
    },
    then: actions([Commanding.issue, { name: "build", args: buildArgs }]),
  });

  /**
   * Start a watcher for the layouts directory when one is configured.
   */
  const DevWatchLayouts: Sync = ({ command, layouts, args }) => ({
    when: actions([Commanding.issue, { name: "dev", args }, { command }]),
    where: (frames) =>
      frames
        .map((frame) => {
          const cmdArgs = frame[args] as Record<string, string>;
          return { ...frame, [layouts]: cmdArgs.layouts ?? "" };
        })
        .filter((frame) => frame[layouts] !== ""),
    then: actions([Watching.start, { subject: layouts, context: command }]),
  });

  /**
   * Start a watcher for the public assets directory when one is configured.
   */
  const DevWatchPublic: Sync = ({ command, publicDir, args }) => ({
    when: actions([Commanding.issue, { name: "dev", args }, { command }]),
    where: (frames) =>
      frames
        .map((frame) => {
          const cmdArgs = frame[args] as Record<string, string>;
          return { ...frame, [publicDir]: cmdArgs.public ?? "" };
        })
        .filter((frame) => frame[publicDir] !== ""),
    then: actions([Watching.start, { subject: publicDir, context: command }]),
  });

  /**
   * Initial build succeeded — mark the dev command as ready.
   *
   * Matches: dev issue + server start (ok) + watcher start (ok) +
   *          initial build issue + build succeed => mark dev ready
   */
  const DevInitialBuildReady: Sync = ({
    devCmd,
    args,
    srv,
    w,
    buildCmd,
    port,
    root,
    url,
    cliInvocation,
  }) => ({
    when: actions(
      [Commanding.issue, { name: "dev", args }, { command: devCmd }],
      [Serving.start, {}, { server: srv }],
      [Watching.start, {}, { watcher: w }],
      [Commanding.issue, { name: "build" }, { command: buildCmd }],
      [Commanding.succeed, { command: buildCmd }, { command: buildCmd }],
    ),
    where: async (frames) => {
      let enriched = await frames.query(
        Serving._getServer,
        { server: srv },
        { port, root },
      );
      enriched = await enriched.query(
        CommandLine._getByOperation,
        { operation: devCmd },
        { invocation: cliInvocation },
      );
      return enriched.map((frame) => ({
        ...frame,
        [url]: `\n  Dev server    http://localhost:${String(frame[port])}\n`,
      }));
    },
    then: actions(
      [CommandLine.notice, { invocation: cliInvocation, message: url }],
      [Commanding.succeed, { command: devCmd, result: "ready" }],
    ),
  });

  /**
   * Initial build failed during dev startup — report the error but keep the
   * server and watcher alive, marking dev as ready anyway.
   */
  const DevInitialBuildFail: Sync = ({
    devCmd,
    args,
    srv,
    w,
    buildCmd,
    invocation,
    buildError,
  }) => ({
    when: actions(
      [Commanding.issue, { name: "dev", args }, { command: devCmd }],
      [Serving.start, {}, { server: srv }],
      [Watching.start, {}, { watcher: w }],
      [Commanding.issue, { name: "build" }, { command: buildCmd }],
      [
        Commanding.fail,
        { command: buildCmd, error: buildError },
        { command: buildCmd },
      ],
    ),
    where: async (frames) => {
      return await frames.query(
        CommandLine._getByOperation,
        { operation: devCmd },
        { invocation },
      );
    },
    then: actions(
      [
        CommandLine.notice,
        {
          invocation,
          message: buildError,
          level: "error",
        },
      ],
      [Commanding.succeed, { command: devCmd, result: "ready" }],
    ),
  });

  /**
   * Serving.start fails — fail the dev command.
   */
  const DevStartFail: Sync = ({ devCmd, args, startError }) => ({
    when: actions(
      [Commanding.issue, { name: "dev", args }, { command: devCmd }],
      [Serving.start, {}, { error: startError }],
    ),
    then: actions([Commanding.fail, { command: devCmd, error: startError }]),
  });

  /**
   * Watching.start fails after successful Serving.start — fail the dev command.
   */
  const DevWatchFail: Sync = ({ devCmd, args, srv, watchError }) => ({
    when: actions(
      [Commanding.issue, { name: "dev", args }, { command: devCmd }],
      [Serving.start, {}, { server: srv }],
      [Watching.start, {}, { error: watchError }],
    ),
    then: actions([Commanding.fail, { command: devCmd, error: watchError }]),
  });

  /**
   * Watching.start fails — fail the dev command (no Serving.start requirement).
   */
  const WatchStartErrorFailsDev: Sync = ({ devCmd, args, watchError }) => ({
    when: actions(
      [Commanding.issue, { name: "dev", args }, { command: devCmd }],
      [Watching.start, {}, { error: watchError }],
    ),
    then: actions([Commanding.fail, { command: devCmd, error: watchError }]),
  });

  /**
   * Runtime watch failure — fail the dev command referenced by the watcher
   * context.
   */
  const WatchRuntimeErrorFailsDev: Sync = ({ devCmd, watchError }) => ({
    when: actions([Watching.fail, {}, { context: devCmd, error: watchError }]),
    where: (frames) =>
      frames.filter((frame) => typeof frame[devCmd] === "string"),
    then: actions([Commanding.fail, { command: devCmd, error: watchError }]),
  });

  /**
   * Source change detected — request a serialized rebuild for the dev session.
   */
  const DevWatchRebuild: Sync = ({ change, subject, context: devCmd }) => ({
    when: actions([Watching.poll, {}, { change, subject, context: devCmd }]),
    then: actions([Coalescing.request, { context: devCmd, kind: "change" }]),
  });

  /**
   * Scheduled build succeeded — release the active slot.
   */
  const ScheduledBuildSucceedFinishes: Sync = ({ buildCmd, args, devCmd }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command: buildCmd }],
      [Commanding.succeed, { command: buildCmd }, { command: buildCmd }],
    ),
    where: async (frames) => {
      frames = await frames.query(
        Commanding._get,
        { command: buildCmd },
        { args },
      );
      return frames
        .map((frame) => ({
          ...frame,
          [devCmd]: (frame[args] as Record<string, string>)._devContext ?? "",
        }))
        .filter((frame) => frame[devCmd] !== "");
    },
    then: actions([Coalescing.finish, { context: devCmd }]),
  });

  /**
   * Scheduled build failed — release the active slot so queued changes can run.
   */
  const ScheduledBuildFailFinishes: Sync = ({
    buildCmd,
    args,
    devCmd,
    buildError,
  }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command: buildCmd }],
      [
        Commanding.fail,
        { command: buildCmd, error: buildError },
        { command: buildCmd },
      ],
    ),
    where: async (frames) => {
      frames = await frames.query(
        Commanding._get,
        { command: buildCmd },
        { args },
      );
      return frames
        .map((frame) => ({
          ...frame,
          [devCmd]: (frame[args] as Record<string, string>)._devContext ?? "",
        }))
        .filter((frame) => frame[devCmd] !== "");
    },
    then: actions([Coalescing.finish, { context: devCmd }]),
  });

  /**
   * Successful scheduled rebuild after a source change — reload browsers and notify.
   */
  const DevRebuildSucceed: Sync = ({
    buildCmd,
    invocation,
    args,
    devCmd,
    kind,
  }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command: buildCmd }],
      [Commanding.succeed, { command: buildCmd }, { command: buildCmd }],
    ),
    where: async (frames) => {
      frames = await frames.query(
        Commanding._get,
        { command: buildCmd },
        { args },
      );
      frames = frames
        .map((frame) => {
          const buildArgs = frame[args] as Record<string, string>;
          return {
            ...frame,
            [devCmd]: buildArgs._devContext ?? "",
            [kind]: buildArgs._devKind ?? "",
          };
        })
        .filter((frame) => frame[devCmd] !== "" && frame[kind] === "change");
      return await frames.query(
        CommandLine._getByOperation,
        { operation: devCmd },
        { invocation },
      );
    },
    then: actions(
      [Serving.reload, {}],
      [
        CommandLine.notice,
        {
          invocation,
          message: "Change detected, rebuilt.",
        },
      ],
    ),
  });

  /**
   * Failed scheduled rebuild after a source change — report error but keep dev alive.
   */
  const DevRebuildFail: Sync = ({
    buildCmd,
    invocation,
    args,
    devCmd,
    kind,
    buildError,
  }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command: buildCmd }],
      [
        Commanding.fail,
        { command: buildCmd, error: buildError },
        { command: buildCmd },
      ],
    ),
    where: async (frames) => {
      frames = await frames.query(
        Commanding._get,
        { command: buildCmd },
        { args },
      );
      frames = frames
        .map((frame) => {
          const buildArgs = frame[args] as Record<string, string>;
          return {
            ...frame,
            [devCmd]: buildArgs._devContext ?? "",
            [kind]: buildArgs._devKind ?? "",
          };
        })
        .filter((frame) => frame[devCmd] !== "" && frame[kind] === "change");
      return await frames.query(
        CommandLine._getByOperation,
        { operation: devCmd },
        { invocation },
      );
    },
    then: actions([
      CommandLine.notice,
      {
        invocation,
        message: buildError,
        level: "error",
      },
    ]),
  });

  return {
    DevStart,
    CoalescedRequestStartsBuild,
    CoalescedFollowUpStartsBuild,
    DevWatchLayouts,
    DevWatchPublic,
    DevInitialBuildReady,
    DevInitialBuildFail,
    DevStartFail,
    DevWatchFail,
    WatchStartErrorFailsDev,
    WatchRuntimeErrorFailsDev,
    DevWatchRebuild,
    ScheduledBuildSucceedFinishes,
    ScheduledBuildFailFinishes,
    DevRebuildSucceed,
    DevRebuildFail,
  };
}
