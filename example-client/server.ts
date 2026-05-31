/**
 * The simplest possible static server for the demo: Bun serves `index.html`,
 * and because Bun bundles HTML routes it transpiles the `<script src="./app.ts">`
 * module **and the SDK TypeScript it imports** for the browser automatically —
 * no separate build step, no bundler config, no extra dependencies.
 *
 * Run it with:  bun run example-client/server.ts   (or `bun run example-client`)
 */
import index from "./index.html";

const port = Number(process.env.EXAMPLE_CLIENT_PORT ?? 3000);

const server = Bun.serve({
  port,
  // `development: true` enables Bun's on-the-fly TS/HTML bundling for the route.
  development: true,
  routes: {
    "/": index,
  },
});

console.log(`\n📰 Forum SDK demo client running at ${server.url}`);
console.log(
  "   Make sure the backend is up (bun run start) and reachable at the\n" +
    "   Base URL shown in the page (default http://localhost:8000/api),\n" +
    "   with CORS allowed for this origin (REQUESTING_ALLOWED_DOMAIN).",
);
