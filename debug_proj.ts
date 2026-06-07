import { createConcepts } from "./src/concepts/concepts";
import { createSyncs } from "./src/syncs/app";

const app = createConcepts();
app.Engine.logging = 2; // VERBOSE for debugging
app.Engine.register(createSyncs(app));

await app.CommandLine.invoke({
  argv: [
    "build",
    "--source",
    "example/pages",
    "--output",
    "/tmp/out",
    "--layouts",
    "example/layouts",
    "--public",
    "example/public",
  ],
});

const all = await app.Filing._getAll();
for (const e of all) {
  if (e.source !== "content") continue;
  const [fields] = await app.Frontmattering._getAllFields({ entry: e.entry });
  if (fields?.fields?.title?.toString().includes("Static Site Generator")) {
    console.log("SSG page found");
    const [html] = await app.Formatting._getHtml({ entry: e.entry });
    console.log("Body HTML has #each:", (html?.html ?? "").includes("{{#each"));
    const layoutName = fields?.fields?.layout ?? "default";
    console.log("Layout name:", layoutName);
    const [layout] = await app.Layouting._getLayout({
      name: String(layoutName),
    });
    console.log(
      "Layout source has #each:",
      (layout?.source ?? "").includes("{{#each"),
    );
  }
}
