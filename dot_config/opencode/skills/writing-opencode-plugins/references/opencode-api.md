# OpenCode v2 Effect plugin API

Distilled from https://opencode.ai/v2/docs/build/plugins/effect (OpenCode 2.1.2). For exact event and editor shapes, read the types in `node_modules/@opencode/plugin`. Other pages: [Promise flavor](https://opencode.ai/v2/docs/build/plugins/), [v1 → v2 migration](https://opencode.ai/v2/docs/build/plugins/migrate-v1), [RPC to the TUI](https://opencode.ai/v2/docs/build/plugins/rpc).

## Shape

```ts
import { Plugin } from "@opencode/plugin/effect"
import { Effect } from "effect"

export default Plugin.define({
  id: "acme.example",
  effect: (ctx) =>
    Effect.gen(function* () {
      yield* Effect.logInfo("loaded", { version: ctx.app.version })
    }),
})
```

- `effect` runs once on load and returns `Effect<void, never, Scope>`. Errors must be handled or turned into defects before they reach it.
- Its scope closes on reload/unload. Every `transform`/`hook` registration, `Effect.forkScoped` fiber, and `Effect.addFinalizer` is released with it. Background work is `Effect.forkScoped`; cleanup is `Effect.addFinalizer`. Manual `AbortController`s and `setInterval`s have no place here.
- Loading: default export from a directory under `.opencode/plugins/` or `~/.config/opencode/plugins/` loads automatically. Anything else goes in the `plugins` array of `opencode.json(c)`, optionally `{ "package": "...", "options": {...} }`.
- Logging: `Effect.logInfo` / `logDebug` / `logWarning` / `logError` with a structured second argument.

## Dependencies

OpenCode supplies `effect` and `@opencode/plugin` at runtime and redirects imports to its own copies.

- Install both as peer/dev dependencies for type-checking only; never bundle them.
- Only public `effect` subpaths load. Importing `effect/internal/...` fails at load time.
- Dependencies built on Effect 3 are not supported.

## Context

`ctx` domains: `app`, `location`, `options`, `agent`, `aisdk`, `command`, `event`, `integration`, `mcp`, `model`, `generate`, `permission`, `plugin`, `provider`, `reference`, `rpc`, `session`, `shell`, `skill`, `storage`, `tool`, `vcs`, `websearch`, `worktree`. There is no access to OpenCode's private services.

**Client calls** (`ctx.session.get(...)`, `ctx.agent.list()`, ...) return `Effect<Response, unknown>`. The response shape differs per call: list calls, `agent.get`, `provider.get`, and `vcs.status` wrap the result as `{ location, data }`, while `session.get` and `session.create` return `Session.Info` directly. Check the type before writing `.data`. The error is `unknown`: either handle it, or `.pipe(Effect.orDie)` when failure means a bug.

**Options**: `ctx.options` is untyped user config. Decode it with `Schema` once at the top of `effect`.

## Storage

Durable JSON scoped to the plugin id. Values are `Schema.Json`; reads come back as `Schema.Json | undefined`, so decode them with the same `Schema` you wrote with.

```ts
get(key): Effect<Schema.Json | undefined>
set(key, value: Schema.Json): Effect<void>
remove(key): Effect<void>
scan({ prefix, after?, limit? }): Effect<{ entries, next? }>
```

## Transforms

`ctx.<domain>.transform(editor => { ... })` for `agent`, `command`, `integration`, `mcp`, `model`, `provider`, `reference`, `skill`, `tool`, `vcs`, `websearch`.

- The callback is **synchronous**; it must not return an Effect or Promise. Load data before registering.
- Transforms are replayed on every rebuild, so keep them cheap and deterministic.
- When data captured by the callback changes, call `yield* ctx.<domain>.reload()`.
- `transform` returns a scoped `Registration`; `yield* registration.dispose` removes it early.

### Tools

```ts
yield* ctx.tool.transform((editor) => {
  editor.add({
    name: "greeting",
    description: "Create a greeting",
    input: Schema.Struct({ name: Schema.String }),
    output: Schema.Struct({ greeting: Schema.String }),
    options: { namespace: "acme", codemode: false },
    execute: ({ name }, context) =>
      Effect.gen(function* () {
        yield* context.progress({ status: "greeting" })
        return { output: { greeting: `Hello ${name}!` } }
      }),
  })
})
```

- `input` is an Effect `Schema`; `execute` gets the decoded value. No hand-written JSON Schema.
- `execute` returns `Effect<{ output?, content?, metadata? }, Tool.Error>`. Its only allowed failure is `Tool.Error` (`new Tool.Error({ message, error?, metadata? })`); map other errors to it. `Tool` is not exported from `@opencode/plugin/effect`; import it with `import { Tool } from "@opencode/schema/tool"` (a dependency of `@opencode/plugin`, so no extra install). Type-checked; behaviour at runtime not yet exercised.
- Aborts: `Tool.Context` (`sessionID`, `agent`, `messageID`, `id`, `progress`) has no `AbortSignal`. When the user aborts, the `execute` fiber is interrupted. Put cleanup in `Effect.onInterrupt(() => ...)`, or `Effect.onError(() => ...)` to cover both failure and interruption. Never create an `AbortController`.
- Schema details for tool input (numbers, descriptions, optional fields): [effect-v4.md](effect-v4.md#schema-in-tool-input).
- `editor.namespace({ name, description })` declares a namespace; the effective tool id is `<namespace>_<name>`.
- `editor.update(id, draft => ...)` and `editor.remove(id)` use the effective id.

### Commands

Add-only. `execute` receives `{ sessionID, prompt, delivery }` and returns an Effect.

```ts
yield* ctx.command.transform((editor) => {
  editor.add({
    name: "security-review",
    description: "Review changes for security issues",
    execute: (input) =>
      ctx.session
        .prompt({ ...input.prompt, sessionID: input.sessionID, text: `Review for security.\n\n${input.prompt.text}`, delivery: input.delivery })
        .pipe(Effect.asVoid),
  })
})
```

## Hooks

`ctx.<domain>.hook(name, (event) => Effect, options?)`. Callbacks mutate `event` in place. Multiple plugins run in plugin order; later hooks see earlier changes. Registrations last for the plugin scope.

| Domain | Hook | Use |
|---|---|---|
| `session` | `context` | edit `event.system`, messages, `event.tools` before an agent-loop model call |
| `session` | `compaction`, `title` | edit, or set `event.result` to skip the model call |
| `session` | `generate` | edit auxiliary generate requests |
| `session` | `model.request` | edit request settings/headers; optional `{ providerID }` filter |
| `session` | `http.request`, `http.response` | raw provider HTTP; `event.kind` is `primary` / `compaction` / `title` / `generate` |
| `session` | `retry` | set `event.decision` to `{ retry: false }` or `{ retry: true, delay }` |
| `tool` | `execute.before` | replace input, or fail with `Tool.Error` to block |
| `tool` | `execute.after` | inspect/replace `event.result`; `event.status` is `"error"` or success |
| `shell` | `create.before` | edit `command`, `cwd`, `timeout`, `shell`, `env` |
| `permission` | `evaluate` | permission decisions (shape: see types) |

`Tool.Error` from `execute.before` and permission denials must propagate; catching them defeats the hook.

## Events

`ctx.event.subscribe()` is a `Stream`. Consume it in a scoped fiber:

```ts
yield* ctx.event.subscribe().pipe(
  Stream.filter((item) => item.type === "config.updated"),
  Stream.runForEach(() => Effect.logInfo("configuration changed")),
  Effect.forkScoped,
)
```

## RPC to a TUI plugin

A server plugin talks to its TUI plugin (`tui.tsx` next to `index.ts`, `@opencode/plugin/tui`) through a shared contract in its own file. Full docs: [RPC](https://opencode.ai/v2/docs/build/plugins/rpc). Checked against the 2.1.2 types:

```ts
// rpc.ts — imported by both index.ts and tui.tsx
import { Rpc } from "@opencode/plugin/rpc"
import { Schema } from "effect"

const BuildRef = Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String }))

export const BuildRpc = Rpc.define({
  id: "acme.builds",
  methods: { status: { input: BuildRef, output: Schema.toStandardSchemaV1(Schema.Struct({ label: Schema.String })) } },
  events: { updated: { schema: BuildRef } },
})
```

- Method and event schemas must be Standard Schema or JSON Schema. A bare Effect `Schema` type-checks on the server but not in the TUI's `ctx.client.rpc(...)`; wrap it with `Schema.toStandardSchemaV1(...)`.
- Server: `const rpc = yield* ctx.rpc.register(BuildRpc, { status: (input, { error }) => Effect... })`. `register` is `Effect<RpcRegistration, unknown, Scope>`, so handle the error or `Effect.orDie`. Handlers return Effects.
- Server events: `rpc.events.emit("updated", { id })` returns `Effect<void, unknown>`. It fails when no TUI is listening, so drop it with `Effect.ignore` and a comment.
- TUI: `const rpc = ctx.client.rpc(BuildRpc)`; methods return Promises; `rpc.events.on("updated", (event) => ...)` returns an unsubscribe function. Call it in the cleanup returned from `setup`.

## v1 → v2 mapping

What you remember (v1, `@opencode-ai/plugin`) and what to write instead:

| v1 | v2 Effect |
|---|---|
| `export const P: Plugin = async (input) => ({ ...hooks })` | `export default Plugin.define({ id, effect })` |
| `tool: { name: tool({ args, execute }) }` | `ctx.tool.transform(editor => editor.add({ input: Schema..., execute }))` |
| `"tool.execute.before"` / `"tool.execute.after"` | `ctx.tool.hook("execute.before" / "execute.after", ...)` |
| `"chat.params"` | `ctx.session.hook("context", ...)` (other v1 hooks: see the migration page) |
| `"permission.ask"` | `ctx.permission.hook("evaluate", ...)` |
| `"shell.env"` | `ctx.shell.hook("create.before", ...)` |
| `event: async ({ event }) => ...` | `ctx.event.subscribe()` + `Effect.forkScoped` |
| `client.app.log(...)` | `Effect.logInfo(...)` |
| module-level variables for state | `ctx.storage` |
