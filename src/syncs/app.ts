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
import { createOutputSync } from "./output.sync";
import { createPipelineErrorSyncs } from "./pipeline-errors.sync";
import { createReportingSyncs } from "./reporting.sync";
import { createTemplatesSync } from "./templates.sync";

export function createSyncs(concepts: AppConcepts) {
  return {
    ...createReportingSyncs(concepts),
    ...createBuildSync(concepts),
    ...createDiscoverySync(concepts),
    ...createContentSync(concepts),
    ...createTemplatesSync(concepts),
    ...createOutputSync(concepts),
    ...createErrorsSync(concepts),
    ...createPipelineErrorSyncs(concepts),
    ...createAssetsSync(concepts),
    ...createCliSyncs(concepts),
    ...createDevSyncs(concepts),
  };
}

// Default instance using module-level singletons
import {
  CommandLine as _CommandLine,
  Serving as _Serving,
  Coalescing,
  Collecting,
  Commanding,
  Filing,
  Formatting,
  Frontmattering,
  Layouting,
  Routing,
  Watching,
} from "@concepts";

const defaultSyncs = createSyncs({
  Coalescing,
  Collecting,
  Commanding,
  CommandLine: _CommandLine,
  Filing,
  Formatting,
  Frontmattering,
  Layouting,
  Routing,
  Serving: _Serving,
  Watching,
} as AppConcepts);
export default defaultSyncs;
