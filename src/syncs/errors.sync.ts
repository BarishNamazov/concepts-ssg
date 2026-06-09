/**
 * Error handling syncs.
 *
 * Filing.scan (failure) → Commanding.fail.
 */

import { Commanding as _Commanding, Filing as _Filing } from "@concepts";
import { actions, type Sync } from "@engine";

type C = {
  Commanding: typeof _Commanding;
  Filing: typeof _Filing;
};

export function createErrorsSync({ Commanding, Filing }: C) {
  const ScanErrorFailsBuild: Sync = ({ command, error }) => ({
    when: actions(
      [Commanding.issue, { name: "build" }, { command }],
      [Filing.scan, {}, { error }],
    ),
    then: actions([Commanding.fail, { command, error }]),
  });

  return {
    ScanErrorFailsBuild,
  };
}

const defaultSyncs = createErrorsSync({
  Commanding: _Commanding,
  Filing: _Filing,
});
export default defaultSyncs;
