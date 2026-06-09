import { SyncConcept } from "@engine";
import BuildingConcept from "./Building/BuildingConcept.ts";
import CollectingConcept from "./Collecting/CollectingConcept.ts";
import CommandLineConcept from "./CommandLine/CommandLineConcept.ts";
import FilingConcept from "./Filing/FilingConcept.ts";
import FormattingConcept from "./Formatting/FormattingConcept.ts";
import FrontmatteringConcept from "./Frontmattering/FrontmatteringConcept.ts";
import LayoutingConcept from "./Layouting/LayoutingConcept.ts";

import RoutingConcept from "./Routing/RoutingConcept.ts";
import ServingConcept from "./Serving/ServingConcept.ts";
import WatchingConcept from "./Watching/WatchingConcept.ts";

type ConceptConstructor = new (namespace?: string) => object;

export const conceptClasses = {
  Building: BuildingConcept,
  CommandLine: CommandLineConcept,
  Filing: FilingConcept,
  Formatting: FormattingConcept,
  Frontmattering: FrontmatteringConcept,
  Collecting: CollectingConcept,
  Layouting: LayoutingConcept,

  Routing: RoutingConcept,
  Serving: ServingConcept,
  Watching: WatchingConcept,
} as const satisfies Record<string, ConceptConstructor>;

export type ConceptName = keyof typeof conceptClasses;
export type ConceptNamespaces = Partial<Record<ConceptName, string>>;

type ConceptInstances = {
  [Name in ConceptName]: InstanceType<(typeof conceptClasses)[Name]>;
};

export interface CreateConceptsOptions {
  engine?: SyncConcept;
  namespaces?: ConceptNamespaces;
  overrides?: Partial<ConceptInstances>;
}

export function createConcepts(
  options: CreateConceptsOptions = {},
): { Engine: SyncConcept } & ConceptInstances {
  const Engine = options.engine ?? new SyncConcept();
  const namespaces = options.namespaces ?? {};
  const overrides = options.overrides ?? {};
  const concepts = Object.fromEntries(
    Object.entries(conceptClasses).map(([name, Concept]) => {
      const override = overrides[name as ConceptName];
      const instance = override ?? new Concept(namespaces[name as ConceptName]);
      return [name, Engine.instrumentConcept(instance)];
    }),
  ) as ConceptInstances;

  return { Engine, ...concepts };
}

export type AppConcepts = ReturnType<typeof createConcepts>;

const appConcepts = createConcepts();

export const Engine = appConcepts.Engine;
export const Building = appConcepts.Building;
export const CommandLine = appConcepts.CommandLine;
export const Filing = appConcepts.Filing;
export const Formatting = appConcepts.Formatting;
export const Frontmattering = appConcepts.Frontmattering;
export const Collecting = appConcepts.Collecting;
export const Layouting = appConcepts.Layouting;

export const Routing = appConcepts.Routing;
export const Serving = appConcepts.Serving;
export const Watching = appConcepts.Watching;
