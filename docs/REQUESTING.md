# The Requesting Server

This document describes the Bun-native HTTP server that turns incoming requests
into concept actions:
`src/concepts/Requesting/RequestingConcept.ts`.

It complements the concept's own
[`src/concepts/Requesting/README.md`](../src/concepts/Requesting/README.md),
which explains the request/respond cycle from a concept author's perspective.
This page focuses on the server mechanics and how they connect to the
[engine](ENGINE.md) and the [SDK](SDK_OVERVIEW.md).

## What Requesting Is

`Requesting` is the provided bootstrap concept: it reifies HTTP requests as
concept actions so the rest of the app can stay pure concepts +
synchronizations. It exposes two actions and one query:

| Member | Kind | Role |
| --- | --- | --- |
| `request({ path, ... })` | action | Create a `Request`, returning `{ request }`. Triggered by an incoming HTTP request. |
| `respond({ request, ... })` | action | Attach a response to a pending `Request`; resolves the awaiting HTTP handler. |
| `_awaitResponse({ request })` | query | Wait up to a timeout for the `Request` response, returning `[{ response }]`. |

`Requesting.requests` is the MongoDB collection that persists request documents
for logging and auditing. Pending in-flight requests are tracked in memory only,
since a promise cannot be persisted.

## From HTTP Request To `Requesting.request`

`startRequestingServer(concepts, options?)` starts `Bun.serve`. Its `fetch`
handler:

1. Answers CORS preflight (`OPTIONS`) immediately with `204` and the CORS
   headers.
2. For a `POST` whose pathname starts with `REQUESTING_BASE_URL`, calls
   `handleRequesting`.
3. Everything else gets `404`.

`handleRequesting` is the core bridge:

```ts
const actionPath = pathname.slice(REQUESTING_BASE_URL.length);
const inputs = { ...body, path: actionPath };

const { request } = await Requesting.request(inputs);
const responseArray = await Requesting._awaitResponse({ request });
return json(responseArray[0].response);
```

Key points:

- The JSON body must be an object; an empty or non-object body is rejected with
  `400`.
- The `path` matched by syncs excludes the base URL. A request to
  `POST /api/auth/login` becomes
  `Requesting.request({ path: "/auth/login", ... })`.
- All other body fields are spread flat alongside `path`, exactly as the
  endpoint's syncs expect.

There are no direct concept passthrough routes. Every public API endpoint is an
explicit `Requesting.request` synchronization.

## How `_awaitResponse` Bridges The Async Response

`Requesting.request` creates a `Promise` and stashes its `resolve`/`reject` in the
in-memory `pending` map keyed by the request id. The HTTP handler then calls
`_awaitResponse`, which races that promise against a timeout:

```ts
const response = await Promise.race([pendingRequest.promise, timeoutPromise]);
```

- If a sync calls `Requesting.respond({ request, ... })`, `respond` looks up the
  pending entry and calls `resolve(response)`, unblocking `_awaitResponse`.
- If no sync responds within `REQUESTING_TIMEOUT`, the timeout promise rejects.
  `handleRequesting` maps a timeout to HTTP `504` and other errors to `500`.

So the lifecycle is: HTTP in -> `request` -> syncs do work -> `respond` ->
`_awaitResponse` returns -> HTTP out. The engine's [flow](ENGINE.md#flows) ties
every action in that chain together. For a full endpoint trace, see the
[`/auth/login` worked example](ENGINE.md#worked-example-post-authlogin).

## How Syncs Answer

Both `request` and `respond` take any parameters as a flat record alongside
`path` / `request`. A success response is just a `then` clause:

```ts
then: actions([Requesting.respond, { request, session, user }]);
```

Domain logic answers through explicit syncs, so the response shape is whatever
the endpoint's typed sync declares. See
[`src/syncs/auth.sync.ts`](../src/syncs/auth.sync.ts) and the endpoint catalogue
in [`docs/API_AND_SDK.md`](API_AND_SDK.md).

## Why Endpoints Are Explicit

The old passthrough model exposed concept methods directly at routes derived from
class and method names. This forum now uses only explicit Requesting endpoints
because reifying requests lets us:

- authorize before doing anything;
- fan out across multiple concepts in one flow;
- shape success and error responses deliberately;
- infer the SDK contract from the same sync definitions used at runtime.

## CORS

Every response carries CORS headers built once at startup:

```ts
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": REQUESTING_ALLOWED_DOMAIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
```

The allowed origin comes from `REQUESTING_ALLOWED_DOMAIN` (default `*`). Pin it
in production:

```bash
REQUESTING_ALLOWED_DOMAIN=https://app.example.com bun run start
```

The [`example-client/`](../example-client/README.md) demo runs on a different
origin from the API and relies on this default.

## Environment Variables

Bun loads `.env` automatically. The server reads:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8000` | Port `Bun.serve` binds. Tests can override with `options.port`. |
| `REQUESTING_BASE_URL` | `/api` | Path prefix for all API requests; stripped before sync matching. |
| `REQUESTING_TIMEOUT` | `10000` ms | How long `_awaitResponse` waits before timing out. |
| `REQUESTING_SAVE_RESPONSES` | `true` | Whether `respond` persists the response onto the request document. |
| `REQUESTING_ALLOWED_DOMAIN` | `*` | `Access-Control-Allow-Origin` value. |

## See Also

- [`src/concepts/Requesting/README.md`](../src/concepts/Requesting/README.md) -
  the request/respond cycle from a concept author's view.
- [`docs/ENGINE.md`](ENGINE.md) - how `Requesting.request` flows through syncs
  and back to `Requesting.respond`.
- [`docs/API_AND_SDK.md`](API_AND_SDK.md) - the endpoint set and typed sync
  contract.
- [`docs/SDK_OVERVIEW.md`](SDK_OVERVIEW.md) - how a typed client calls these
  endpoints.
