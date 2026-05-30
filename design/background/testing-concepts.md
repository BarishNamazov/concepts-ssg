# Concept Testing

Testing concepts involves primarily:
1. Confirming that for each action:
    - **requires** is satisfied: if a variety of test cases that do not fulfill the requirement are tested against the concept, they do not succeed (or return a record with an `error:` key).
    - **effects** is satisfied: after the action is performed, we can verify that the state did indeed change according to the effect (or the return is correctly specified).
2. Ensuring that the **principle** is fully modeled by the actions:
    - Demonstrate that the series of actions described in the **principle**, when performed, result in the specified behavior or updates to state.
    
# approach: steps to testing

The following prefix format for header 1 blocks denote the relevant steps:

- `# file: src/{name}/{name}Concept.test.ts`
    - The test file for the concept
- `# trace:`
    - Describes a full trace of actions, such as how the principle is fulfilled.

After the concept specification and file, create another test file that properly tests the concept, and propose how the trace might work.

# Test implementation

Tests run on Bun's built-in test runner (`bun test`). A test file lives next to the concept as `src/concepts/{Name}/{Name}Concept.test.ts`.

Use the `setupTestDb` helper from `@utils/testing.ts`, which starts an isolated in-memory MongoDB (`mongodb-memory-server`) and returns a connected, empty database. Instantiate the concept directly against that database, and tear the server down in an `afterAll` hook:

```typescript
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { setupTestDb } from "@utils/testing.ts";
import LabelingConcept from "./LabelingConcept.ts";

const mongo = await setupTestDb();
const Labeling = new LabelingConcept(mongo.db);

afterAll(() => mongo.stop());

describe("Labeling", () => {
  test("addLabel adds a label to an item", async () => {
    // ... arrange, act, assert with expect(...)
  });
});
```

Because each test file gets its own in-memory server, the database starts empty. If you need a clean slate between tests within a file, clear the relevant collections in a `beforeEach` hook.

Assertions use Bun's `expect` API (`expect(value).toBe(...)`, `.toEqual(...)`, `.toThrow()`, etc.).

# Legible testing

 - Each test should output what it is doing and the trace of any actions, to help with debugging and increasing confidence that the concept or action is doing what it says.
 - Principle tests and tests involving multiple actions should explain how it aligns with expectations.
 - For action tests, the output should explain how requirements are met and how effects are confirmed.