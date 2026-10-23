# Effect v4 for plugins

OpenCode runs plugins on `effect@4.0.1`. Most Effect code you remember is v3: v3 names fail to type-check or, worse, resolve to something else. When unsure whether a name exists, grep `node_modules/effect/src` rather than guess.

Sources: [LLMS.md](LLMS.md) (Effect's own agent guide, local copy), [MIGRATION.md](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md), [v3 → v4 rename map](https://github.com/Effect-TS/effect/blob/main/migration/v3-to-v4.md), [Schema v4 guide](https://github.com/Effect-TS/effect/blob/main/packages/effect/SCHEMA.md) (large; read the section you need).

## v3 → v4 renames

Every v4 name on this page was checked against the `effect@4.0.1` source. Pre-release 4.0.0 betas differ (e.g. `Schema.TaggedErrorClass` instead of `Schema.TaggedError`); if a name is missing, check which `effect` version is installed.

| v3 (what you will reach for) | v4 |
|---|---|
| `Effect.catchAll` | `Effect.catch` |
| `Effect.catchAllCause` | `Effect.catchCause` |
| `Effect.catchAllDefect` | `Effect.catchDefect` |
| `Effect.catchSome` | `Effect.catchFilter` (with the `Filter` module) |
| `Either` | `Result` |
| `Context.Tag` / `Effect.Tag` | `Context.Service` |
| `FiberRef` | `Context.Reference` |
| `effect/ParseResult` | `SchemaIssue` / `SchemaParser` |
| `JSONSchema` | `JsonSchema` |
| `@effect/platform/*`, `@effect/rpc`, other `@effect/*` cores | `effect/*` |
| `effect/unstable/<x>` | `effect/<x>` |

Schema was rewritten: annotations, transformations, filters, and class APIs all changed. Before writing anything beyond `Schema.Struct` / `Schema.String` / `Schema.Number` / `Schema.Literal` / `Schema.optionalKey`, check SCHEMA.md or the source.

## Writing Effect code

- Inline code: `Effect.gen(function* () { ... })`.
- Reusable functions returning an Effect: `Effect.fn("name")(function* (...) { ... })` when a trace span helps, `Effect.fnUntraced(function* (...) { ... })` otherwise. A plain function whose body is just `return Effect.gen(...)` is the v3 habit; write `Effect.fnUntraced` instead.
- `Effect.fn` takes extra combinators as further arguments: `Effect.fn("name")(function* () {...}, Effect.catch(...))`. It has no `.pipe`.
- Raise errors with `return yield* new MyError({...})`. The `return` tells TypeScript the branch ends.
- Attach behaviour with `.pipe(...)` on `Effect.gen` results, not by nesting more generators.

```ts
const save = Effect.fnUntraced(function* (id: string, entry: Entry) {
  yield* ctx.storage.set(`entry/${id}`, Schema.encodeSync(Entry)(entry))
  yield* Effect.logDebug("saved", { id })
})
```

## Errors

- Domain errors: `class NotFound extends Schema.TaggedError<NotFound>()("NotFound", { id: Schema.String }) {}`.
- Recover from one error: `Effect.catchTag("NotFound", ...)`; several: `Effect.catchTag(["A", "B"], ...)` or `Effect.catchTags({...})`; everything: `Effect.catch`.
- At a tool's `execute` boundary, every remaining error becomes `Tool.Error` (see [opencode-api.md](opencode-api.md#tools)).
- Failure that means a bug (OpenCode client calls, impossible states): `Effect.orDie`.
- Deliberately dropping a failure (best-effort notification): `Effect.ignore`, with a comment saying why.

## Data and checks

- Untrusted data is decoded with `Schema`: `Schema.decodeUnknownEffect(S)(value)` in Effect code, `Schema.decodeUnknownSync(S)` in pure code; `Schema.encodeSync(S)` before writing to storage. Hand-rolled parsing and `typeof` ladders are the thing to avoid.
- Runtime guards come from `Predicate` (`Predicate.isObject`, `Predicate.isString`, ...). Writing your own `isRecord` duplicates it.
- "Decode or skip" without an error channel: `Schema.decodeUnknownOption(S)(value)` returns an `Option`.
- Time: `DateTime` and `Clock` instead of `Date` / `Date.now()` in Effect code, so tests can control time.

## Schema in tool input

The model reads the JSON Schema generated from a tool's `input`. Checked against `effect@4.0.1`:

- Numbers: `Schema.Finite` generates `{ "type": "number" }`. `Schema.Number` generates `anyOf: [number, "Infinity" | "-Infinity" | "NaN"]`, inviting the model to send strings.
- Descriptions the model sees: `Schema.String.annotate({ description: "..." })`, on the field schema.
- Optional fields: `Schema.optionalKey(S)` types as `a?: S`; `Schema.optional(S)` as `a?: S | undefined`. With `exactOptionalPropertyTypes` (on in our tsconfig) these are different types, and the `| undefined` leaks into every API you pass the value to. Use `optionalKey` unless `undefined` is a meaningful value.

```ts
input: Schema.Struct({
  exitCode: Schema.Finite.annotate({ description: "Exit code of the test command" }),
  output: Schema.optionalKey(Schema.String.annotate({ description: "Test output summary" })),
}),
```

## Services

Plugins are usually small enough that `ctx` plus a few `Effect.fnUntraced` functions is the whole design. Reach for `Context.Service` + `Layer` only when a dependency needs swapping in tests. See the Services section of LLMS.md for the v4 form.
