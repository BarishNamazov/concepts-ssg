/**
 * Error handling syncs.
 *
 * Filing.scan (failure) → Building.fail.
 */

import { Building as _Building, Filing as _Filing } from "@concepts";
import { actions, type Sync } from "@engine";

type C = {
  Building: typeof _Building;
  Filing: typeof _Filing;
};

export function createErrorsSync({ Building, Filing }: C) {
  const ScanErrorFailsBuild: Sync = ({ build, error }) => ({
    when: actions(
      [Building.start, {}, { build }],
      [Filing.scan, {}, { error }],
    ),
    then: actions([Building.fail, { build, error }]),
  });

  return {
    ScanErrorFailsBuild,
  };
}

const defaultSyncs = createErrorsSync({
  Building: _Building,
  Filing: _Filing,
});
export default defaultSyncs;
