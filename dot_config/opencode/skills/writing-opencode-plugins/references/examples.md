# Before / after examples

Each pair shows code an LLM typically writes, then what the rules in [SKILL.md](../SKILL.md) ask for. Rule numbers refer to the Core rules there.

Every "after" snippet was type-checked with the repo `tsconfig.json` against `@opencode/plugin@2.1.2` and `effect@4.0.1`. The `enum` "before" is rejected by the compiler (`erasableSyntaxOnly`).

## Pass-through wrappers and early extraction (rules 1, 2)

Before:

```ts
const getStorageKey = (id: string) => `build/${id}`

const readBuild = (id: string) => ctx.storage.get(getStorageKey(id))

const loadBuild = (id: string) =>
  Effect.gen(function* () {
    const raw = yield* readBuild(id)
    return raw
  })
```

After:

```ts
const loadBuild = (id: string) => ctx.storage.get(`build/${id}`)
```

Three functions with one call site each collapse into one. If the key appears in a third place, extract it then.

## Effect functions (rule 2)

Before:

```ts
function save(id: string, build: Build) {
  return Effect.gen(function* () {
    yield* ctx.storage.set(`build/${id}`, Schema.encodeSync(Build)(build))
  })
}
```

After:

```ts
const save = Effect.fnUntraced(function* (id: string, build: Build) {
  yield* ctx.storage.set(`build/${id}`, Schema.encodeSync(Build)(build))
})
```

## Flat control flow (rule 3)

Before:

```ts
function summary(build: Build | undefined) {
  if (build) {
    if (build.status === "failed") {
      if (build.errors.length > 0) {
        return `Failed: ${build.errors[0]}`
      } else {
        return "Failed"
      }
    } else {
      return build.status
    }
  }
  return "No build"
}
```

After:

```ts
function summary(build: Build | undefined): string {
  if (build === undefined) return "No build"
  if (build.status !== "failed") return build.status
  return build.errors[0] === undefined ? "Failed" : `Failed: ${build.errors[0]}`
}
```

## Building for today (rule 5)

Before:

```ts
type FormatOptions = { separator?: string; uppercase?: boolean; maxItems?: number }

function formatFiles(files: ReadonlyArray<string>, options: FormatOptions = {}) {
  const { separator = "\n", uppercase = false, maxItems = Infinity } = options
  return files
    .slice(0, maxItems)
    .map((f) => (uppercase ? f.toUpperCase() : f))
    .join(separator)
}
```

After:

```ts
const fileList = files.join("\n")
```

Nothing calls it with options, and it has one call site (rule 1).

## Shortest clear form (rule 6)

Before:

```ts
const failed: Array<string> = []
for (const build of builds) {
  if (build.status === "failed") {
    failed.push(build.id)
  }
}
```

After:

```ts
const failed = builds.filter((b) => b.status === "failed").map((b) => b.id)
```

## Return type annotations (rule 8)

Annotate when there is more than one `return` or the function is exported. The annotation catches a missing branch where it happens, and keeps a discriminated union from widening:

```ts
type Check = { ok: true } | { ok: false; reason: string }

export function parseCheck(text: string): Check {
  if (text.startsWith("ok")) return { ok: true }
  return { ok: false, reason: text }
}
```

Without `: Check`, `ok: true` widens to `boolean` and the union is lost.

Do not annotate small single-expression helpers or locals:

```ts
// Before
const isDone = (b: Build): boolean => b.status === "passed" || b.status === "failed"
const count: number = builds.length

// After
const isDone = (b: Build) => b.status === "passed" || b.status === "failed"
const count = builds.length
```

Inline callbacks are not annotated, even with several returns; the API they are passed to types them:

```ts
// Before
execute: ({ branch }): Effect.Effect<{ output: string }, Tool.Error> => Effect.gen(function* () { ... })

// After
execute: ({ branch }) => Effect.gen(function* () { ... })
```

In Effect code, annotate only the same boundary cases, with `Effect.fn.Return<A, E>`:

```ts
const loadBuild = Effect.fnUntraced(function* (id: string): Effect.fn.Return<Build | undefined> {
  const raw = yield* ctx.storage.get(`build/${id}`)
  if (raw === undefined) return undefined
  return yield* Schema.decodeUnknownEffect(Build)(raw).pipe(Effect.orDie)
})
```

## One source per type (rules 9, 12)

Before:

```ts
interface BuildInput {
  branch: string
  clean?: boolean
}

const input = {
  type: "object",
  properties: { branch: { type: "string" }, clean: { type: "boolean" } },
  required: ["branch"],
}

execute: (args: unknown) => {
  const { branch, clean } = args as BuildInput
  // ...
}
```

After:

```ts
const BuildInput = Schema.Struct({
  branch: Schema.String,
  clean: Schema.optionalKey(Schema.Boolean),
})
type BuildInput = typeof BuildInput.Type

editor.add({
  name: "build",
  description: "Run a build on a branch",
  input: BuildInput,
  execute: ({ branch, clean }) => Effect.gen(function* () { /* ... */ }),
})
```

The schema is the type, the JSON Schema, and the decoder. No interface, no hand-written JSON Schema, no cast.

## Storage reads (rule 12)

Before:

```ts
const raw = yield* ctx.storage.get(`build/${id}`)
const build = raw as unknown as Build
```

After:

```ts
const raw = yield* ctx.storage.get(`build/${id}`)
const build = raw === undefined ? undefined : yield* Schema.decodeUnknownEffect(Build)(raw).pipe(Effect.orDie)
```

## Discriminated unions for state (rule 10)

Before:

```ts
type Build = {
  id: string
  running: boolean
  finished: boolean
  exitCode?: number
  errors?: Array<string>
  startedAt?: number
}
```

Nothing stops `running: true, finished: true`, and every reader checks optional fields.

After:

```ts
const Build = Schema.Union([
  Schema.Struct({ status: Schema.Literal("queued"), id: Schema.String }),
  Schema.Struct({ status: Schema.Literal("running"), id: Schema.String, startedAt: Schema.Number }),
  Schema.Struct({ status: Schema.Literal("passed"), id: Schema.String }),
  Schema.Struct({ status: Schema.Literal("failed"), id: Schema.String, errors: Schema.Array(Schema.String) }),
])
type Build = typeof Build.Type
```

Each field exists exactly in the states where it means something. `switch (build.status)` narrows the rest.

## No enums (rule 11)

Before:

```ts
enum Status {
  Queued = "queued",
  Running = "running",
}
```

After:

```ts
type Status = "queued" | "running"
```

Or, when the values are also needed at runtime, `const Status = Schema.Literals(["queued", "running"])`.

## Checks the types already rule out (rule 13)

Before:

```ts
function label(build: Build) {
  if (!build) return ""
  const id = build?.id ?? "unknown"
  try {
    return `${build.status}: ${id}`
  } catch {
    return id
  }
}
```

After:

```ts
const label = (build: Build) => `${build.status}: ${build.id}`
```

`build` is not optional, `id` is a required string, and string interpolation does not throw.

When the type really includes `undefined`, guard once and let the guard narrow:

```ts
// Before: re-checks after every access
const build = yield* loadBuild(id) // Build | undefined
if (build?.status === "failed") return build?.errors?.[0] ?? "Failed"

// After
const build = yield* loadBuild(id)
if (build?.status !== "failed") return undefined
return build.errors[0] ?? "Failed"
```

After the guard, `build` is the `failed` member of the union: no more `?.`. The `??` stays because `errors[0]` really can be missing under `noUncheckedIndexedAccess`.

## Errors through Effect (rule 14)

Before:

```ts
execute: ({ url }) =>
  Effect.gen(function* () {
    try {
      const response = yield* Effect.promise(() => fetch(url))
      return { output: yield* Effect.promise(() => response.text()) }
    } catch (error) {
      yield* Effect.logError("fetch failed", { error })
      throw error
    }
  })
```

`try` around `yield*` catches nothing useful, `Effect.promise` turns rejections into defects anyway, and the log-and-rethrow duplicates the report.

After:

```ts
import { Tool } from "@opencode/schema/tool"

execute: ({ url }) =>
  Effect.tryPromise({
    try: () => fetch(url).then((r) => r.text()),
    catch: (error) => new Tool.Error({ message: `Fetching ${url} failed`, error }),
  }).pipe(Effect.map((text) => ({ output: text })))
```

A tool's `execute` may only fail with `Tool.Error`; the model sees its `message`. Domain errors from deeper code are mapped to `Tool.Error` at this boundary (`Effect.mapError`), or handled before it.

Dropping a failure on purpose is allowed, with the reason next to it:

```ts
// The TUI may not be open; a missed refresh is harmless.
yield* notifyTui(id).pipe(Effect.ignore)
```

## Names (rule 15)

Before:

```ts
const data = yield* ctx.storage.scan({ prefix: "build/" })
const result = data.entries.map((item) => item.key)
```

After:

```ts
const page = yield* ctx.storage.scan({ prefix: "build/" })
const buildKeys = page.entries.map((e) => e.key)
```

`e` is fine: its scope is one line.

## Comments (rule 16)

Before:

```ts
/**
 * Loads a build.
 * @param id - The build id.
 * @returns The build.
 */
const loadBuild = ...

// Increment the attempt counter
attempts++
```

After:

```ts
const loadBuild = ...

// Session hooks are retried; count attempts so the second run does not re-prompt.
attempts++
```

## Pure logic in its own file (rule 18)

```
plugins/builds/
  index.ts          // Plugin.define: decode options, register tool, wire storage
  status.ts         // export function nextStatus(build: Build, event: BuildEvent): Build
  status.test.ts    // bun test: every transition, no ctx, no Effect runtime
```

`status.ts` has no imports from `@opencode/plugin`. If a test needs a fake `ctx`, the logic is in the wrong file.
