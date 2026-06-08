/**
 * Error handling syncs.
 *
 * Filing.scan (failure) → Commanding.fail.
 */

import {
  Building as _Building,
  Commanding as _Commanding,
  Filing as _Filing,
} from "@concepts";
import { actions, type Sync } from "@engine";

type C = {
  Building: typeof _Building;
  Commanding: typeof _Commanding;
  Filing: typeof _Filing;
};

export function createErrorsSync({ Building, Commanding, Filing }: C) {
  const ScanErrorFailsBuild: Sync = ({ command, build, error }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command }],
      [Building.start, {}, { build }],
      [Filing.scan, {}, { error }],
    ),
    then: actions(
      [Building.fail, { build, error }],
      [Commanding.fail, { command, error }],
    ),
  });

  return {
    ScanErrorFailsBuild,
  };
}

const defaultSyncs = createErrorsSync({
  Building: _Building,
  Commanding: _Commanding,
  Filing: _Filing,
});
export default defaultSyncs;
