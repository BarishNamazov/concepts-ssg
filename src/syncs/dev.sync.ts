/**
 * Dev-mode syncs — static declarations for dev server startup, file watching,
 * rebuild on change, and live reload.
 *
 * All syncs are registered statically; no conditional registration.
 */

import type { AppConcepts } from "@concepts";
import { actions, type Sync } from "@engine";

export function createDevSyncs({
  Building,
  CommandLine,
  Serving,
  Watching,
}: Pick<AppConcepts, "Building" | "CommandLine" | "Serving" | "Watching">) {
  /**
   * Dev startup: when a dev-start build is requested with context, start the
   * server, watch the source directory, and kick off the build.
   */
  const DevStart: Sync = ({
    build,
    config,
    kind,
    context,
    source,
    output,
    port,
  }) => ({
    when: actions([
      Building.request,
      { kind: "dev-start" },
      { build, config, kind, context },
    ]),
    where: (frames) =>
      frames.map((frame) => {
        const cfg = frame[config] as Record<string, string>;
        return {
          ...frame,
          [source]: cfg.source,
          [output]: cfg.output,
          [port]: parseInt(cfg.port ?? "3000", 10),
        };
      }),
    then: actions(
      [Serving.start, { port, root: output }],
      [Watching.start, { subject: source, context }],
    ),
  });

  /**
   * Start a watcher for the layouts directory when one is configured.
   */
  const DevWatchLayouts: Sync = ({
    build,
    config,
    kind,
    context,
    layouts,
  }) => ({
    when: actions([Building.start, {}, { build, config, kind, context }]),
    where: (frames) =>
      frames
        .filter((frame) => frame[kind] === "dev-start")
        .map((frame) => {
          const cfg = frame[config] as Record<string, string>;
          return { ...frame, [layouts]: cfg.layouts ?? "" };
        })
        .filter((frame) => frame[layouts] !== ""),
    then: actions([Watching.start, { subject: layouts, context }]),
  });

  /**
   * Start a watcher for the public assets directory when one is configured.
   */
  const DevWatchPublic: Sync = ({
    build,
    config,
    kind,
    context,
    publicDir,
  }) => ({
    when: actions([Building.start, {}, { build, config, kind, context }]),
    where: (frames) =>
      frames
        .filter((frame) => frame[kind] === "dev-start")
        .map((frame) => {
          const cfg = frame[config] as Record<string, string>;
          return { ...frame, [publicDir]: cfg.public ?? "" };
        })
        .filter((frame) => frame[publicDir] !== ""),
    then: actions([Watching.start, { subject: publicDir, context }]),
  });

  /**
   * Initial build succeeded — mark the dev invocation as ready.
   */
  const DevInitialBuildReady: Sync = ({
    build,
    config,
    kind,
    context,
    srv,
    w,
    port,
    root,
    url,
  }) => ({
    when: actions(
      [Building.start, {}, { build, config, kind, context }],
      [Serving.start, {}, { server: srv }],
      [Watching.start, {}, { watcher: w }],
      [Building.complete, { build }, { build }],
    ),
    where: async (frames) => {
      const filtered = frames.filter((frame) => frame[kind] === "dev-start");
      const enriched = await filtered.query(
        Serving._getServer,
        { server: srv },
        { port, root },
      );
      return enriched.map((frame) => ({
        ...frame,
        [url]: `\n  Dev server    http://localhost:${String(frame[port])}\n`,
      }));
    },
    then: actions(
      [CommandLine.notice, { invocation: context, message: url }],
      [CommandLine.ready, { invocation: context }],
    ),
  });

  /**
   * Initial build failed during dev startup — report the error but mark dev
   * as ready anyway so the server stays alive.
   */
  const DevInitialBuildFail: Sync = ({
    build,
    config,
    kind,
    context,
    srv,
    w,
    buildError,
  }) => ({
    when: actions(
      [Building.start, {}, { build, config, kind, context }],
      [Serving.start, {}, { server: srv }],
      [Watching.start, {}, { watcher: w }],
      [Building.fail, { build }, { build, error: buildError }],
    ),
    where: (frames) => frames.filter((frame) => frame[kind] === "dev-start"),
    then: actions(
      [
        CommandLine.notice,
        {
          invocation: context,
          message: buildError,
          level: "error",
        },
      ],
      [CommandLine.ready, { invocation: context }],
    ),
  });

  /**
   * Serving.start fails — fail the dev invocation.
   */
  const DevStartFail: Sync = ({ invocation, build, context, startError }) => ({
    when: actions(
      [Building.start, {}, { build, context }],
      [Serving.start, {}, { error: startError }],
    ),
    where: (frames) =>
      frames.map((frame) => ({ ...frame, [invocation]: frame[context] })),
    then: actions([CommandLine.fail, { invocation, error: startError }]),
  });

  /**
   * Watching.start fails after successful Serving.start — fail the dev invocation.
   */
  const DevWatchFail: Sync = ({
    invocation,
    build,
    context,
    srv,
    watchError,
  }) => ({
    when: actions(
      [Building.start, {}, { build, context }],
      [Serving.start, {}, { server: srv }],
      [Watching.start, {}, { error: watchError }],
    ),
    where: (frames) =>
      frames.map((frame) => ({ ...frame, [invocation]: frame[context] })),
    then: actions([CommandLine.fail, { invocation, error: watchError }]),
  });

  /**
   * Watching.start fails — fail the dev invocation (no Serving.start requirement).
   */
  const WatchStartErrorFailsDev: Sync = ({
    invocation,
    build,
    context,
    watchError,
  }) => ({
    when: actions(
      [Building.start, {}, { build, context }],
      [Watching.start, {}, { error: watchError }],
    ),
    where: (frames) =>
      frames.map((frame) => ({ ...frame, [invocation]: frame[context] })),
    then: actions([CommandLine.fail, { invocation, error: watchError }]),
  });

  /**
   * Runtime watch failure — fail the dev invocation referenced by the watcher
   * context.
   */
  const WatchRuntimeErrorFailsDev: Sync = ({ invocation, watchError }) => ({
    when: actions([
      Watching.fail,
      {},
      { context: invocation, error: watchError },
    ]),
    where: (frames) =>
      frames.filter((frame) => typeof frame[invocation] === "string"),
    then: actions([CommandLine.fail, { invocation, error: watchError }]),
  });

  /**
   * Source change detected — request a build for the dev context.
   */
  const DevWatchRebuild: Sync = ({ change, subject, context }) => ({
    when: actions([Watching.poll, {}, { change, subject, context }]),
    then: actions([Building.request, { context, kind: "change", config: {} }]),
  });

  /**
   * Successful rebuild — reload browsers and notify.
   */
  const DevRebuildSucceed: Sync = ({ build, config, kind, context }) => ({
    when: actions(
      [Building.start, {}, { build, config, kind, context }],
      [Building.complete, { build }, { build }],
    ),
    where: (frames) => frames.filter((frame) => frame[kind] === "change"),
    then: actions(
      [Serving.reload, {}],
      [
        CommandLine.notice,
        {
          invocation: context,
          message: "Change detected, rebuilt.",
        },
      ],
    ),
  });

  /**
   * Failed rebuild — report error but keep dev alive.
   */
  const DevRebuildFail: Sync = ({
    build,
    config,
    kind,
    context,
    buildError,
  }) => ({
    when: actions(
      [Building.start, {}, { build, config, kind, context }],
      [Building.fail, { build }, { build, error: buildError }],
    ),
    where: (frames) => frames.filter((frame) => frame[kind] === "change"),
    then: actions([
      CommandLine.notice,
      {
        invocation: context,
        message: buildError,
        level: "error",
      },
    ]),
  });

  return {
    DevStart,
    DevWatchLayouts,
    DevWatchPublic,
    DevInitialBuildReady,
    DevInitialBuildFail,
    DevStartFail,
    DevWatchFail,
    WatchStartErrorFailsDev,
    WatchRuntimeErrorFailsDev,
    DevWatchRebuild,
    DevRebuildSucceed,
    DevRebuildFail,
  };
}
