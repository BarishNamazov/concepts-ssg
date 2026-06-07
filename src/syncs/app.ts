/**
 * Static site generator build pipeline syncs.
 *
 * Pipeline:
 *   command "build" → configure + layout-scan + content-scan + finalize + succeed
 *   scan (success) → read → parse → render + route + collect → apply → write
 *   scan (failure) → command fail
 */

import type { AppConcepts } from "@concepts";
import { createAssetsSync } from "./assets.sync";
import { createBuildSync } from "./build.sync";
import { createCliSyncs } from "./cli.sync";
import { createContentSync } from "./content.sync";
import { createDevSyncs } from "./dev.sync";
import { createDiscoverySync } from "./discovery.sync";
import { createErrorsSync } from "./errors.sync";
import { createPublishingSync } from "./publishing.sync";
import { createTemplatesSync } from "./templates.sync";

export function createSyncs(concepts: AppConcepts) {
  return {
    ...createBuildSync(concepts),
    ...createDiscoverySync(concepts),
    ...createContentSync(concepts),
    ...createTemplatesSync(concepts),
    ...createPublishingSync(concepts),
    ...createErrorsSync(concepts),
    ...createAssetsSync(concepts),
    ...createCliSyncs(concepts),
    ...createDevSyncs(concepts),
  };
}

// Default instance using module-level singletons
import {
  CommandLine as _CommandLine,
  Serving as _Serving,
  Building,
  Collecting,
  Commanding,
  Filing,
  Formatting,
  Frontmattering,
  Layouting,
  Publishing,
  Routing,
  Watching,
} from "@concepts";

const defaultSyncs = createSyncs({
  Building,
  Collecting,
  Commanding,
  CommandLine: _CommandLine,
  Filing,
  Formatting,
  Frontmattering,
  Layouting,
  Publishing,
  Routing,
  Serving: _Serving,
  Watching,
} as AppConcepts);
export default defaultSyncs;
