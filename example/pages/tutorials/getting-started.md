---
title: Getting Started
layout: Tutorial
date: 2026-06-01
collections: tutorials
description: Set up a Concept Design project, understand the directory structure, and run your first build.
---

## Getting Started

This tutorial walks you through setting up a Concept Design project from scratch.

### Prerequisites

- [Bun](https://bun.sh) runtime (v1.0+)
- A text editor
- Basic TypeScript knowledge

### Project Structure

```
my-project/
├── src/
│   ├── concepts/        # One folder per concept
│   │   ├── concepts.ts  # Registry + factory
│   │   └── Filing/
│   │       ├── FilingConcept.ts
│   │       └── FilingConcept.test.ts
│   ├── syncs/           # Synchronization rules
│   │   └── app.ts       # Root composition
│   ├── engine/          # Sync engine (reusable)
│   └── main.ts          # Entry point
├── example/             # Example site content
│   ├── layouts/         # HTML templates
│   ├── pages/           # Markdown source
│   └── public/          # Static assets
├── package.json
└── tsconfig.json
```

### Creating Your First Concept

Create `src/concepts/Greeting/GreetingConcept.ts`:

```typescript
export default class GreetingConcept {
  private message = "Hello, Concept Design!";

  async greet(): Promise<{ message: string }> {
    return { message: this.message };
  }
}
```

Register it in `src/concepts/concepts.ts`:

```typescript
import GreetingConcept from "./Greeting/GreetingConcept.ts";

export const conceptClasses = {
  Greeting: GreetingConcept,
  // ... other concepts
};
```

### Writing Your First Sync

Create `src/syncs/greeting.sync.ts`:

```typescript
import { actions, type Sync } from "@engine";

export const HelloWorld: Sync = ({ msg }) => ({
  when: actions([Commanding.issue, { name: "greet" }, {}]),
  then: actions([Greeting.greet, {}]),
});
```

### Running the Build

```bash
# Run the example site
bun run src/main.ts build \
  --source example/pages \
  --output example/dist \
  --layouts example/layouts \
  --public example/public

# Run tests
bun test

# Typecheck
bun run typecheck
```

### Next Steps

Now that you have a project set up, continue to **[Your First Concept](/tutorials/first-concept)** to learn how to design a concept with state, actions, and queries.
