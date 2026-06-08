/**
 * Output syncs.
 *
 * Layouting.apply → Filing.setContent + Filing.write.
 */

import {
  Filing as _Filing,
  Layouting as _Layouting,
  Routing as _Routing,
} from "@concepts";
import { actions, type Sync } from "@engine";

type C = {
  Filing: typeof _Filing;
  Layouting: typeof _Layouting;
  Routing: typeof _Routing;
};

export function createOutputSync({ Filing, Layouting, Routing }: C) {
  const ApplyTriggersWrite: Sync = ({
    entry,
    composed,
    route,
    outputRelativePath,
  }) => ({
    when: actions([Layouting.apply, {}, { entry }]),
    where: async (frames) => {
      frames = await frames.query(
        Layouting._getComposed,
        { entry },
        { composed },
      );
      frames = await frames.query(Routing._getRoute, { entry }, { route });
      return frames.map((frame) => {
        const r = (frame[route] as string) ?? "/";
        const outputPath =
          r === "/" ? "index.html" : `${r.replace(/^\//, "")}/index.html`;
        return { ...frame, [outputRelativePath]: outputPath };
      });
    },
    then: actions(
      [Filing.setContent, { entry, content: composed }],
      [Filing.write, { entry, outputRelativePath }],
    ),
  });

  return { ApplyTriggersWrite };
}

const defaultSyncs = createOutputSync({
  Filing: _Filing,
  Layouting: _Layouting,
  Routing: _Routing,
});
export default defaultSyncs;
