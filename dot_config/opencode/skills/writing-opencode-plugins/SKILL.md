---
name: writing-opencode-plugins
description: Writes OpenCode v2 plugins in Effect v4 (`@opencode/plugin/effect`). Use when creating, editing, reviewing, or porting an OpenCode plugin — tools, hooks, transforms, commands, storage, events.
---

# Writing OpenCode plugins

Target: OpenCode **2.1.2**, `@opencode/plugin@2.1.2` imported from `@opencode/plugin/effect`, `effect@4.0.1`.

Your memory of OpenCode plugins is mostly the v1 API (`@opencode-ai/plugin`, hook objects, `client.app.log`) and your memory of Effect is mostly v3. Both are wrong here. Ground truth, in order:

1. Installed types: `node_modules/@opencode/plugin` and `node_modules/effect/src`.
2. The references in this skill.
3. Memory — only for what 1 and 2 confirm.

## Steps

1. Read [references/opencode-api.md](references/opencode-api.md) before touching `ctx`.
2. Read [references/effect-v4.md](references/effect-v4.md) before writing Effect code. For any Effect API it does not cover, read [references/LLMS.md](references/LLMS.md), then the source in `node_modules/effect/src`.
3. Read [references/gotchas.md](references/gotchas.md).
4. Write the code, following the core rules below.
5. Verify. Done means all of these hold:
   - `bun x tsc --noEmit` reports zero errors.
   - `bun test` is green (pure logic has tests).
   - `opencode service restart`, then the plugin's tool/command/hook was exercised once and behaved.

   If `tsconfig.json` or the `@opencode/plugin` / `effect` dev dependencies are missing at the repo root, say so to the user. A step you could not run is reported as not run.

## Core rules

The default failure is code that is longer and more abstract than the problem. Every helper, type, branch, and file must earn its place by a use that exists today. Before/after pairs for these rules: [references/examples.md](references/examples.md). Read it before writing code, and again before declaring a change done.

### Size and shape

1. **Inline until the third use.** One or two call sites get the code written in place. Extract on the third, when the shared shape is known.
2. **No pass-through wrappers.** A function that only forwards its arguments to another function, or only returns `Effect.gen(...)`, is deleted. Use `Effect.fnUntraced` / `Effect.fn` for reusable Effect functions.
3. **Flat control flow.** Guard clauses and early returns; at most two levels of nesting inside a function.
4. **Files by concern.** One file per thing the plugin does (tool, hook, pure logic). No `utils.ts`, `types.ts`, `constants.ts`, `helpers.ts` grab bags.
5. **Build for today's requirement.** No options, generics, config flags, or extension points for cases nobody asked for.
6. **Shortest clear form.** `map`/`filter` over push loops; a plain loop over a `reduce` that needs a comment to read.
7. **Only export what another module imports.** The plugin file's `export default Plugin.define(...)` is the one required export.

### Types

8. **Annotate the boundaries, infer the rest.** Annotate return types on exported functions and on functions with more than one `return`; in Effect code use `Effect.fn.Return<A, E>` for those. This applies to named functions only: inline callbacks (a tool's `execute`, hook callbacks, `Effect.gen` bodies passed as arguments) are typed by what they are passed to and are never annotated. Never annotate locals or single-expression helpers.
9. **One source per type.** Data that is decoded gets a `Schema`, and its TypeScript type is `typeof X.Type`. Never write a parallel `interface` for the same shape.
10. **Discriminated unions for state.** A value that can be in several states is a union tagged by a literal field, not one object with optional fields and booleans.
11. **Literal unions and `as const`, never `enum`.**
12. **No `as`, `!`, or `any`.** Untrusted data (tool input, storage reads, options, event payloads, HTTP bodies) is `unknown` until decoded with `Schema`. An `as` cast means a decode is missing. The one exception is a cast the compiler cannot express, with a comment saying why.
13. **Check only what the types allow.** No `?.`, `??`, `if (!x)`, or `try` around values whose type says they are present and cannot throw. When the type does include `undefined` (a storage read, a lookup), checking is correct: one guard that narrows, then plain access.

### Errors

14. **Errors go through Effect.** No `try`/`catch` inside Effect code; wrap throwing or Promise APIs once at the edge with `Effect.try` / `Effect.tryPromise`. Each failure is handled with intent (`Effect.catchTag`), turned into a defect (`Effect.orDie`), or dropped with `Effect.ignore` plus a one-line comment saying why. No log-and-rethrow.

### Names and comments

15. **Names from the domain.** Descriptive names; short names (`s`, `e`, `i`) only in a scope of 10 lines or fewer.
16. **Comments add information.** Say why, or what the code cannot show. JSDoc only when it says something the name and type do not.

### Dependencies

17. **Platform first.** Reach in this order: Effect modules (`Schema`, `DateTime`, `Stream`, `Schedule`, `HttpClient`, `Predicate`, ...), Bun/Node built-ins, `ctx`, a few dozen lines of our own code. **Ask the user before adding any package**, stating what it does that we cannot reasonably write and whether it depends on `effect` (it must not: plugins run on the host's copy). Crypto, security, and complex parsers always use a well-maintained package.

### Testing

18. **Pure logic in its own file, tested.** Parsing, formatting, and state transitions are plain functions with a `*.test.ts` next to them run by `bun test`. The plugin file wires them to `ctx`.

### Sources

Rules 1–2: [Rule of three](https://en.wikipedia.org/wiki/Rule_of_three_(computer_programming)), [Inline Function](https://refactoring.com/catalog/inlineFunction.html), Effect [LLMS.md](references/LLMS.md). Rule 3: [Guard Clauses](https://refactoring.com/catalog/replaceNestedConditionalWithGuardClauses.html). Rule 5: [Yagni](https://martinfowler.com/bliki/Yagni.html). Rules 7, 12, 15, 16: [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html). Rule 8: [Effective TypeScript Item 18](https://github.com/danvk/effective-typescript/blob/main/samples/ch-inference/avoid-inferable.md). Rule 9: [Item 15](https://github.com/danvk/effective-typescript/blob/main/samples/ch-types/map-between-types.md). Rule 10: [Items 29](https://github.com/danvk/effective-typescript/blob/main/samples/ch-design/valid-states.md), [34](https://github.com/danvk/effective-typescript/blob/main/samples/ch-design/union-of-interfaces.md), [37](https://github.com/danvk/effective-typescript/blob/main/samples/ch-design/avoid-optional.md). Rule 11: [Item 72](https://github.com/danvk/effective-typescript/blob/main/samples/ch-write-run/avoid-non-ecma.md). Rule 13: [no-unnecessary-condition](https://typescript-eslint.io/rules/no-unnecessary-condition/). Rule 17: [Go proverbs](https://go-proverbs.github.io/), [Our Software Dependency Problem](https://research.swtch.com/deps). Rules 4, 6, 18 are house style.
