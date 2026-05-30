# Context: LLM framework for Concept Design

This repository contains the Context tool and a set of **design documents** that provide comprehensive context for generating and implementing applications using [**concept design**](design/background/concept-design-overview.md). 

## Setup

- After installing [Deno](https://deno.com/), run the following command to compile Context:
```bash
deno compile -A --output ctx .ctx/context.ts
```

- Insert your `GEMINI_API_KEY` into `.env.template` and rename to `.env`, or simply copy into your existing `.env` file.
- For VSCode users, we recommend installing Terry's [ctx-tool](https://marketplace.visualstudio.com/items?itemName=terrytwk.ctx-tool) extension.
- When you actually run the code, don't forget to include any other environment variables you need, such as database configuration.

## Using Context

Context enables *composition of knowledge and specification* to ease LLM generation of exactly what you need. The only syntax you need to know are *context inclusions*, which is simply a valid markdown link with an `@` sign as the first character of *the link text*. For example:

```markdown
[@concept-design-overview](design/background/concept-design-overview.md)

Inclusions must be in their own paragraph (ensure that there is a new line before and after) and be the only element in the paragraph. The contents of the linked file, *including the contents of any nested inclusions*, will replace the inclusion. Links are by default *relative* to the file, and can be made relative to the root of the repository instead by prepending `/` to the beginning of the link.
```

## Describing your application

**To get started**, navigate to the `design/application/` folder and insert the following information about your app into each file:

- `app-overview.md`: Describe the overview of your app and its functional design. Leave concept specifications out of this document, and place each of them instead under `design/concepts/{name}/{name}.md`, where `{name}` is the name of your concept.
- `all-concepts.md`: *Include (use the `@` linking)* all concept specifications for your app. 
- `all-synchronizations.md`: *Include* all synchronization specifications for your app. 

## Tools: simple templates for interacting with LLMs

Under `design/tools/` are a series of simple prompts that prepackage a bunch of useful context for you to use. As you prompt with Context, we actually encourage that instead of continuing the conversation, **prefer to update documentation and re-prompt**. The `extract-memory.md` tool (described below) is particularly useful for this pattern. 

### tool: `ask.md`

This tool not only packages all the context about concept design, but will also maintain context inclusions of the entire description of your app. Be sure to keep all files under `design/application` updated to ensure that the LLM will also know about any changes you make to your concepts or synchronizations. You are **encouraged to read each tool** to understand how they compose context, and you should also feel free to edit and update tools however you like.

To use, suppose you are editing `design/brainstorming/question.md`:

```markdown
[@ask](/design/tools/ask.md)

What are some simple behaviors of my app that I could incrementally implement with a small set of synchronizations first?
```

Simply run "Ctx: Prompt" in the VSCode extension, or `./ctx prompt design/brainstorming/question.md` to get a response.

### tool: `generate-concept.md`

This tool provides the minimal context to generate a concept specification. You should try to *include* a full concept specification, but you may use the tool to also ideate and create a specification.

```markdown
[@generate-concept](/design/tools/generate-concept.md)

[@LikertSurvey](/design/concepts/LikertSurvey/LikertSurvey.md)
```

> **Note:** this tool *does not* include context about your application, as you should be able to generate concepts as purely modular and independent increments of functionality.

### tool: `generate-synchronizations.md`

This tool provides both the full context about concept design as well as details of your app to generate new or yet-to-be implemented synchronizations. You should describe the *behavior* or features you'd like to implement. **Please work incrementally** and test the functionality of each synchronization! This will save you headache and frustration, and lead to more confident development iteration.

```markdown
[@generate-synchronizations](/design/tools/generate-synchronizations.md)

Implement my login behavior using UserAuthentication and Sessioning.
```

### tool: `extract-memory.md`

This tool provides an easy way to **mitigate wasted time/effort while iterating with LLMs**. Whenever you receive some output that is not fully functional, such as broken code, try to **save what was learned as a memory**. For example, suppose a generation of a concept looks something like this:

```markdown
[@generate-concept](/design/tools/generate-concept.md)

Specify and implement a FileUploading concept.

# concept: FileUploading
...
...

# file: src/concepts/FileUploading/FileUploadingConcept.ts
...
...

# error:
The queries are broken because...
...

# solution:
Of course! The problem is ...
```

To mitigate the LLM making the same mistake again for other concepts, extract the memory:

```markdown
... previous file ...

[@extract-memory](/design/tools/extract-memory.md)
```

This will produce some markdown that you should paste under the appropriate file under `design/memories`, currently either to do with `concept-learnings.md` or `sync-learnings.md`, which will enrich the associated generation tools with the memory.

> **Important:** as you can see, none of these tools are "special" code or set in stone! They are simply a pattern of text and composing documentation that are meant to help you get started in thinking about managing your collaboration with LLMs. We **highly encourage** coming up with your own tools and patterns, and exercise your agency to create the workflow best tailored to you.

### tool: `spec-for-frontend.md`

This tool packages up your concept and synchronization specifications, given the context of your application, as a single document to hand-off for frontend development. 

```markdown
[@spec-for-frontend](/design/tools/spec-for-frontend.md)
```

> **Important:** the context mainly works off your specifications, so be sure to keep them up-to-date with your code! Alternatively, add inclusions for your actual code files to the context of this tool (how best to do this in a modular fashion is left as an exercise).

## Debugging prompts

At any time, if you feel like the LLM simply isn't receiving the right context or seems to be hallucinating in unexpected ways, you can view **the exact context** that was passed to the LLM. This is the nature of the `context/` directory, which contains a mirror of the rest of the directory structure, where all files are versioned by timestamp and content hash. Simply go to the corresponding *directory* named after the file you're working on, and step through the versions to see if the LLM received the right context, or e.g. if you forgot to add a newline after an `@` inclusion. We recommend Obsidian to view these version files, as it'll preview the links nicely as embedded blocks.