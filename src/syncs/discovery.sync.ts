/**
 * File discovery syncs.
 *
 * Filing.scan (success) → Filing.read (one per discovered entry).
 */

import { Filing as _Filing } from "@concepts";
import { actions, type Sync } from "@engine";

type C = { Filing: typeof _Filing };

export function createDiscoverySync({ Filing }: C) {
  const ScanTriggersRead: Sync = ({ entry, entries }) => ({
    when: actions([Filing.scan, {}, { entries }]),
    where: (frames) =>
      frames.flatMap((frame) => {
        const entryIds = frame[entries] as string[];
        return entryIds.map((id) => ({ ...frame, [entry]: id }));
      }),
    then: actions([Filing.read, { entry }]),
  });

  return { ScanTriggersRead };
}

const defaultSyncs = createDiscoverySync({ Filing: _Filing });
export default defaultSyncs;
