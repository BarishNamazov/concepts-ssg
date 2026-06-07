/**
 * Pipeline error syncs.
 *
 * Filing.read/write, Formatting.render, Layouting.apply,
 * Routing.derive errors → Commanding.fail.
 */

import {
  Commanding as _Commanding,
  Filing as _Filing,
  Formatting as _Formatting,
  Layouting as _Layouting,
  Routing as _Routing,
} from "@concepts";
import { actions, type Sync } from "@engine";

type C = {
  Commanding: typeof _Commanding;
  Filing: typeof _Filing;
  Formatting: typeof _Formatting;
  Layouting: typeof _Layouting;
  Routing: typeof _Routing;
};

export function createPipelineErrorSyncs({
  Commanding,
  Filing,
  Formatting,
  Layouting,
  Routing,
}: C) {
  const ReadErrorFailsBuild: Sync = ({ command, error }) => ({
    when: actions([Filing.read, { command }, { error }]),
    then: actions([Commanding.fail, { command, error }]),
  });

  const WriteErrorFailsBuild: Sync = ({ command, error }) => ({
    when: actions([Filing.write, { command }, { error }]),
    then: actions([Commanding.fail, { command, error }]),
  });

  const RenderErrorFailsBuild: Sync = ({ command, error }) => ({
    when: actions([Formatting.render, { command }, { error }]),
    then: actions([Commanding.fail, { command, error }]),
  });

  const ApplyErrorFailsBuild: Sync = ({ command, error }) => ({
    when: actions([Layouting.apply, { command }, { error }]),
    then: actions([Commanding.fail, { command, error }]),
  });

  const DeriveErrorFailsBuild: Sync = ({ command, error }) => ({
    when: actions([Routing.derive, {}, { error }]),
    where: async (frames) => {
      return await frames.query(Commanding._get, {}, { command });
    },
    then: actions([Commanding.fail, { command, error }]),
  });

  return {
    ReadErrorFailsBuild,
    WriteErrorFailsBuild,
    RenderErrorFailsBuild,
    ApplyErrorFailsBuild,
    DeriveErrorFailsBuild,
  };
}

const defaultSyncs = createPipelineErrorSyncs({
  Commanding: _Commanding,
  Filing: _Filing,
  Formatting: _Formatting,
  Layouting: _Layouting,
  Routing: _Routing,
});
export default defaultSyncs;
