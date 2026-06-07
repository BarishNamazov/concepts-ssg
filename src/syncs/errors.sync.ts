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
    when: actions([Filing.scan, { command, source: "content" }, { error }]),
    then: actions([Commanding.fail, { command, error }]),
  });

  const LayoutScanErrorFailsBuild: Sync = ({ command, error }) => ({
    when: actions([Filing.scan, { command, source: "layouts" }, { error }]),
    then: actions([Commanding.fail, { command, error }]),
  });

  const PublicScanErrorFailsBuild: Sync = ({ command, error }) => ({
    when: actions([Filing.scan, { command, source: "public" }, { error }]),
    then: actions([Commanding.fail, { command, error }]),
  });

  return {
    ScanErrorFailsBuild,
    LayoutScanErrorFailsBuild,
    PublicScanErrorFailsBuild,
  };
}

const defaultSyncs = createErrorsSync({
  Commanding: _Commanding,
  Filing: _Filing,
});
export default defaultSyncs;
