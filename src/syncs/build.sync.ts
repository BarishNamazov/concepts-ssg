/**
 * Build command sync.
 *
 * Pipeline entry point: `Commanding.issue("build")` →
 * configure + scan layouts + scan content + scan public + complete build.
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
  const BuildCommandStartsBuild: Sync = ({ command, args }) => ({
    when: actions([
      Commanding.issue,
      { name: "build", args },
      { command, name: "build" },
    ]),
    then: actions([Building.start, {}]),
  });

  const BuildStartedRunsPipeline: Sync = ({
    command,
    build,
    args,
    source,
    output,
    layouts,
    publicDir,
  }) => ({
    when: actions(
      [Commanding.issue, { name: "build", args }, { command }],
      [Building.start, {}, { build }],
    ),
    where: (frames) =>
      frames.map((frame) => {
        const cmdArgs = frame[args] as Record<string, string>;
        return {
          ...frame,
          [source]: cmdArgs.source,
          [output]: cmdArgs.output,
          [layouts]: cmdArgs.layouts ?? "",
          [publicDir]: cmdArgs.public ?? "",
        };
      }),
    then: actions(
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
        },
      ],
      [
        Filing.scan,
        {
          directory: source,
          patterns: ["**/*.{md,html,htm}"],
          outputDirectory: output,
          source: "content",
        },
      ],
      [
        Filing.scan,
        {
          directory: publicDir,
          patterns: ["**/*"],
          outputDirectory: output,
          source: "public",
        },
      ],
      [Building.complete, { build }],
      [Filing.cleanOutput, { outputDirectory: output }],
      [Commanding.succeed, { command }],
    ),
  });

  return { BuildCommandStartsBuild, BuildStartedRunsPipeline };
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
