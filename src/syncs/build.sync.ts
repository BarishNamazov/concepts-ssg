/**
 * Build command sync.
 *
 * Pipeline entry point: `Building.start` →
 * clear + configure + scan layouts + scan content + scan public + complete build.
 */

import {
  Building as _Building,
  Collecting as _Collecting,
  Filing as _Filing,
  Frontmattering as _Frontmattering,
  Routing as _Routing,
} from "@concepts";
import { actions, type Sync } from "@engine";

type C = {
  Building: typeof _Building;
  Collecting: typeof _Collecting;
  Filing: typeof _Filing;
  Frontmattering: typeof _Frontmattering;
  Routing: typeof _Routing;
};

export function createBuildSync({
  Building,
  Collecting,
  Filing,
  Frontmattering,
  Routing,
}: C) {
  /**
   * A REQUESTED build starts immediately regardless of context.
   */
  const RequestStartsBuild: Sync = ({ build, config, kind }) => ({
    when: actions([Building.request, {}, { build, config, kind }]),
    then: actions([Building.start, { build }]),
  });

  /**
   * Every RUNNING build triggers the full pipeline.
   */
  const BuildStartedRunsPipeline: Sync = ({
    build,
    config,
    kind,
    source,
    output,
    layouts,
    publicDir,
  }) => ({
    when: actions([Building.start, {}, { build, config, kind }]),
    where: (frames) =>
      frames.map((frame) => {
        const cfg = frame[config] as Record<string, string>;
        return {
          ...frame,
          [source]: cfg.source,
          [output]: cfg.output,
          [layouts]: cfg.layouts ?? "",
          [publicDir]: cfg.public ?? "",
        };
      }),
    then: actions(
      [Filing.clear, {}],
      [Collecting.clear, {}],
      [Frontmattering.clear, {}],
      [Routing.clear, {}],
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
      [Filing.cleanOutput, { outputDirectory: output }],
      [Building.complete, { build }],
    ),
  });

  /**
   * When a completed/failed build spawns a pending follow-up, start it.
   */
  const CompleteStartsNextBuild: Sync = ({ build, nextBuild }) => ({
    when: actions([Building.complete, {}, { build, nextBuild }]),
    then: actions([Building.start, { build: nextBuild }]),
  });

  const FailStartsNextBuild: Sync = ({ build, nextBuild }) => ({
    when: actions([Building.fail, {}, { build, nextBuild }]),
    then: actions([Building.start, { build: nextBuild }]),
  });

  return {
    RequestStartsBuild,
    BuildStartedRunsPipeline,
    CompleteStartsNextBuild,
    FailStartsNextBuild,
  };
}

const defaultSyncs = createBuildSync({
  Building: _Building,
  Collecting: _Collecting,
  Filing: _Filing,
  Frontmattering: _Frontmattering,
  Routing: _Routing,
});
export default defaultSyncs;
