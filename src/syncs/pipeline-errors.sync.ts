/**
 * Pipeline error syncs.
 *
 * Filing.read/write/copy, Formatting.render, Layouting.apply,
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
    when: actions(
      [Commanding.issue, { name: "build" }, { command }],
      [Filing.read, {}, { error }],
    ),
    then: actions([Commanding.fail, { command, error }]),
  });

  const WriteErrorFailsBuild: Sync = ({ command, error }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command }],
      [Filing.write, {}, { error }],
    ),
    then: actions([Commanding.fail, { command, error }]),
  });

  const CopyErrorFailsBuild: Sync = ({ command, error }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command }],
      [Filing.copy, {}, { error }],
    ),
    then: actions([Commanding.fail, { command, error }]),
  });

  const RenderErrorFailsBuild: Sync = ({ command, error }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command }],
      [Formatting.render, {}, { error }],
    ),
    then: actions([Commanding.fail, { command, error }]),
  });

  const ApplyErrorFailsBuild: Sync = ({ command, error }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command }],
      [Layouting.apply, {}, { error }],
    ),
    then: actions([Commanding.fail, { command, error }]),
  });

  const DeriveErrorFailsBuild: Sync = ({ command, error }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command }],
      [Routing.derive, {}, { error }],
    ),
    then: actions([Commanding.fail, { command, error }]),
  });

  const SetContentErrorFailsBuild: Sync = ({ command, error }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command }],
      [Filing.setContent, {}, { error }],
    ),
    then: actions([Commanding.fail, { command, error }]),
  });

  const CleanOutputErrorFailsBuild: Sync = ({ command, error }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command }],
      [Filing.cleanOutput, {}, { error }],
    ),
    then: actions([Commanding.fail, { command, error }]),
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
  Commanding: _Commanding,
  Filing: _Filing,
  Formatting: _Formatting,
  Layouting: _Layouting,
  Routing: _Routing,
});
export default defaultSyncs;
