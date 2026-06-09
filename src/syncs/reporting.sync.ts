/**
 * Reporting syncs — aggregate and display build stats and dev server info
 * so the CLI output is legible rather than a wall of TRACE lines.
 */
import type { AppConcepts } from "@concepts";
import { actions, type Sync } from "@engine";

export function createReportingSyncs({
  Commanding,
  CommandLine,
  Filing,
}: Pick<AppConcepts, "Commanding" | "CommandLine" | "Filing">) {
  /**
   * After the build pipeline finishes scanning every file, report a
   * one-line summary before the CLI prints "Build complete."
   */
  const BuildReportStats: Sync = ({
    invocation,
    command,
    source,
    fileList,
    statsMsg,
  }) => ({
    when: actions(
      [CommandLine.invoke, {}, { invocation }],
      [Commanding.issue, { name: "build" }, { command }],
      [Commanding.succeed, { command }, {}],
    ),
    where: async (frames) => {
      return (await frames.query(Filing._getAll, {}, { source }))
        .collectAs([source], fileList)
        .map((frame) => {
          const files = frame[fileList] as { source: string }[];
          const content = files.filter((f) => f.source === "content").length;
          const layouts = files.filter((f) => f.source === "layouts").length;
          const pub = files.filter((f) => f.source === "public").length;
          return {
            ...frame,
            [statsMsg]: `  Pages: ${content}  Layouts: ${layouts}  Assets: ${pub}  Total: ${files.length}`,
          };
        });
    },
    then: actions([CommandLine.notice, { invocation, message: statsMsg }]),
  });

  return { BuildReportStats };
}
