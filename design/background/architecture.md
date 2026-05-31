# Architecture Overview

The concept design approach structures its architecture entirely around two fundamental building blocks:

1.  **Concepts**: Self-contained, modular increments of functionality (e.g., `Sessioning`, `Posting`, `Commenting`).
2.  **Synchronizations**: The rules that orchestrate interactions *between* concepts (e.g., "when a post is deleted, delete all its comments").

## Directory Structure

> **Important:** You should only need to add code within the `src/concepts` and `src/syncs` directories.

```
context/
design/
src/
├── concepts/       <-- YOUR CONCEPTS HERE
│   ├── Sessioning/
│   │   └── SessioningConcept.ts
│   ├── Posting/
│   │   └── PostingConcept.ts
│   └── ...
├── syncs/          <-- YOUR SYNCHRONIZATIONS HERE
│   ├── auth.sync.ts
│   └── posts.sync.ts
│
├── engine/         <-- Framework-provided (ignore)
├── utils/          <-- Framework-provided (ignore)
└── main.ts         <-- Entry-point (can configure logging)
```

## The `Requesting` Concept: Application Entry-point

The architecture will automatically spin up an HTTP server for your application. However, you might wonder how exactly an external HTTP request triggers your logic. This is handled by the provided concept called `Requesting`.

When an HTTP request hits the server, the Concept Engine automatically translates it into a `Requesting.request` action. You don't implement this concept; you just use its actions as triggers in your synchronizations. Public endpoints are explicit synchronizations; concept methods are not exposed directly as HTTP routes.

For example, an incoming request like `POST /api/posts/create` with a JSON body `{ "title": "My First Post", "content": "Hello world!", "session": "s123" }` is automatically converted into an action that looks like this:

`Requesting.request({ path: "/posts/create", title: "My First Post", content: "Hello world!", session: "s123" })`

You can then write a [synchronization](implementing-synchronizations.md) to "catch" this action and do something useful with it:

```typescript
// in src/syncs/posts.sync.ts
const CreatePostOnRequest: Sync = ({ title, content, session, user }) => ({
    when: actions(
        // Catches the request from the engine
        [Requesting.request, { path: "/posts/create", title, content, session }, {}],
    ),
    where: (frames) => {
        // Authorizes the request by checking the session
        return frames
            .query(Sessioning.getUser, { session }, { user });
    },
    then: actions(
        // If we got here, we found a logged in user
        [Posting.create, { title, content, author: user }],
    ),
});
```

By creating the `Sessioning` and `Posting` concepts and including this synchronization, you created an operational and authenticated API endpoint for creating posts. The `Requesting` concept encapsulates the concerns surrounding HTTP requests, and therefore abstracted away the need for specifying a HTTP server, controllers, middleware, etc.

## Initialization

1. Configure any environment variables you need in `.env` (Bun loads this automatically).
2. Build command: `bun run build` to scan and automatically generate imports for concepts.
3. Start command: `bun run start` to begin your server.
