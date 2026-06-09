/**
 * Pipeline error syncs.
 *
 * Filing.read/write/copy, Formatting.render, Layouting.apply,
 * Routing.derive errors → Building.fail.
 */

import {
  Building as _Building,
  Filing as _Filing,
  Formatting as _Formatting,
  Layouting as _Layouting,
  Routing as _Routing,
} from "@concepts";
import { actions, type Sync } from "@engine";

type C = {
  Building: typeof _Building;
  Filing: typeof _Filing;
  Formatting: typeof _Formatting;
  Layouting: typeof _Layouting;
  Routing: typeof _Routing;
};

export function createPipelineErrorSyncs({
  Building,
  Filing,
  Formatting,
  Layouting,
  Routing,
}: C) {
  const ReadErrorFailsBuild: Sync = ({ build, error }) => ({
    when: actions(
      [Building.start, {}, { build }],
      [Filing.read, {}, { error }],
    ),
    then: actions([Building.fail, { build, error }]),
  });

  const WriteErrorFailsBuild: Sync = ({ build, error }) => ({
    when: actions(
      [Building.start, {}, { build }],
      [Filing.write, {}, { error }],
    ),
    then: actions([Building.fail, { build, error }]),
  });

  const CopyErrorFailsBuild: Sync = ({ build, error }) => ({
    when: actions(
      [Building.start, {}, { build }],
      [Filing.copy, {}, { error }],
    ),
    then: actions([Building.fail, { build, error }]),
  });

  const RenderErrorFailsBuild: Sync = ({ build, error }) => ({
    when: actions(
      [Building.start, {}, { build }],
      [Formatting.render, {}, { error }],
    ),
    then: actions([Building.fail, { build, error }]),
  });

  const ApplyErrorFailsBuild: Sync = ({ build, error }) => ({
    when: actions(
      [Building.start, {}, { build }],
      [Layouting.apply, {}, { error }],
    ),
    then: actions([Building.fail, { build, error }]),
  });

  const DeriveErrorFailsBuild: Sync = ({ build, error }) => ({
    when: actions(
      [Building.start, {}, { build }],
      [Routing.derive, {}, { error }],
    ),
    then: actions([Building.fail, { build, error }]),
  });

  const SetContentErrorFailsBuild: Sync = ({ build, error }) => ({
    when: actions(
      [Building.start, {}, { build }],
      [Filing.setContent, {}, { error }],
    ),
    then: actions([Building.fail, { build, error }]),
  });

  const CleanOutputErrorFailsBuild: Sync = ({ build, error }) => ({
    when: actions(
      [Building.start, {}, { build }],
      [Filing.cleanOutput, {}, { error }],
    ),
    then: actions([Building.fail, { build, error }]),
  });

  return {
    ReadErrorFailsBuild,
    WriteErrorFailsBuild,
    CopyErrorFailsBuild,
    RenderErrorFailsBuild,
    ApplyErrorFailsBuild,
    DeriveErrorFailsBuild,
    SetContentErrorFailsBuild,
    CleanOutputErrorFailsBuild,
  };
}

const defaultSyncs = createPipelineErrorSyncs({
  Building: _Building,
  Filing: _Filing,
  Formatting: _Formatting,
  Layouting: _Layouting,
  Routing: _Routing,
});
export default defaultSyncs;
