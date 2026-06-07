/**
 * Build command sync.
 *
 * Pipeline entry point: `Commanding.issue("build")` →
 * configure + scan layouts + scan content + complete build.
 */

import {
  Building as _Building,
  Collecting as _Collecting,
  Commanding as _Commanding,
  Filing as _Filing,
  Frontmattering as _Frontmattering,
  Routing as _Routing,
} from "@concepts";
import { actions, type Sync } from "@engine";

type C = {
  Building: typeof _Building;
  Collecting: typeof _Collecting;
  Commanding: typeof _Commanding;
  Filing: typeof _Filing;
  Frontmattering: typeof _Frontmattering;
  Routing: typeof _Routing;
};

export function createBuildSync({
  Building,
  Collecting,
  Commanding,
  Filing,
  Frontmattering,
  Routing,
}: C) {
  const BuildCommand: Sync = ({ command, args, source, output, layouts }) => ({
    when: actions([
      Commanding.issue,
      { name: "build", args },
      { command, name: "build" },
    ]),
    where: (frames) =>
      frames.map((frame) => {
        const cmdArgs = frame[args] as Record<string, string>;
        return {
          ...frame,
          [source]: cmdArgs.source,
          [output]: cmdArgs.output,
          [layouts]: cmdArgs.layouts ?? "",
        };
      }),
    then: actions(
      [Building.start, { command }],
      [Filing.clear, {}],
      [Collecting.clear, {}],
      [Frontmattering.clear, {}],
      [Routing.configure, { stripPrefix: source, indexName: "index" }],
      [
        Filing.scan,
        {
          directory: layouts,
          patterns: ["*.html"],
          outputDirectory: output,
          source: "layouts",
          command,
        },
      ],
      [
        Filing.scan,
        {
          directory: source,
          patterns: ["**/*.{md,html,htm}"],
          outputDirectory: output,
          source: "content",
          command,
        },
      ],
      [Building.complete, { build: command }],
      [Filing.cleanOutput, {}],
      [Commanding.succeed, { command }],
    ),
  });

  return { BuildCommand };
}

const defaultSyncs = createBuildSync({
  Building: _Building,
  Collecting: _Collecting,
  Commanding: _Commanding,
  Filing: _Filing,
  Frontmattering: _Frontmattering,
  Routing: _Routing,
});
export default defaultSyncs;
