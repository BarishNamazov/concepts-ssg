/**
 * Pipeline error syncs.
 *
 * Filing.read/write, Formatting.render, Layouting.apply,
 * Routing.derive errors → Commanding.fail.
 */

import {
  Building as _Building,
  Commanding as _Commanding,
  Filing as _Filing,
  Formatting as _Formatting,
  Layouting as _Layouting,
  Routing as _Routing,
} from "@concepts";
import { actions, type Sync } from "@engine";

type C = {
  Building: typeof _Building;
  Commanding: typeof _Commanding;
  Filing: typeof _Filing;
  Formatting: typeof _Formatting;
  Layouting: typeof _Layouting;
  Routing: typeof _Routing;
};

export function createPipelineErrorSyncs({
  Building,
  Commanding,
  Filing,
  Formatting,
  Layouting,
  Routing,
}: C) {
  const ReadErrorFailsBuild: Sync = ({ command, build, error }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command }],
      [Building.start, {}, { build }],
      [Filing.read, {}, { error }],
    ),
    then: actions(
      [Building.fail, { build, error }],
      [Commanding.fail, { command, error }],
    ),
  });

  const WriteErrorFailsBuild: Sync = ({ command, build, error }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command }],
      [Building.start, {}, { build }],
      [Filing.write, {}, { error }],
    ),
    then: actions(
      [Building.fail, { build, error }],
      [Commanding.fail, { command, error }],
    ),
  });

  const RenderErrorFailsBuild: Sync = ({ command, build, error }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command }],
      [Building.start, {}, { build }],
      [Formatting.render, {}, { error }],
    ),
    then: actions(
      [Building.fail, { build, error }],
      [Commanding.fail, { command, error }],
    ),
  });

  const ApplyErrorFailsBuild: Sync = ({ command, build, error }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command }],
      [Building.start, {}, { build }],
      [Layouting.apply, {}, { error }],
    ),
    then: actions(
      [Building.fail, { build, error }],
      [Commanding.fail, { command, error }],
    ),
  });

  const DeriveErrorFailsBuild: Sync = ({ command, build, error }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command }],
      [Building.start, {}, { build }],
      [Routing.derive, {}, { error }],
    ),
    then: actions(
      [Building.fail, { build, error }],
      [Commanding.fail, { command, error }],
    ),
  });

  const SetContentErrorFailsBuild: Sync = ({ command, build, error }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command }],
      [Building.start, {}, { build }],
      [Filing.setContent, {}, { error }],
    ),
    then: actions(
      [Building.fail, { build, error }],
      [Commanding.fail, { command, error }],
    ),
  });

  const CleanOutputErrorFailsBuild: Sync = ({ command, build, error }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command }],
      [Building.start, {}, { build }],
      [Filing.cleanOutput, {}, { error }],
    ),
    then: actions(
      [Building.fail, { build, error }],
      [Commanding.fail, { command, error }],
    ),
  });

  return {
    ReadErrorFailsBuild,
    WriteErrorFailsBuild,
    RenderErrorFailsBuild,
    ApplyErrorFailsBuild,
    DeriveErrorFailsBuild,
    SetContentErrorFailsBuild,
    CleanOutputErrorFailsBuild,
  };
}

const defaultSyncs = createPipelineErrorSyncs({
  Building: _Building,
  Commanding: _Commanding,
  Filing: _Filing,
  Formatting: _Formatting,
  Layouting: _Layouting,
  Routing: _Routing,
});
export default defaultSyncs;
