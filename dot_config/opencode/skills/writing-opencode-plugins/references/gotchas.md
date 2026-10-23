# Gotchas (OpenCode 2.1.2)

Runtime behaviour that is not obvious from the docs or types.

- **Restart after edits.** The background server keeps the old plugin loaded: `opencode service restart`.
- **State lives in `ctx.storage`, never in module or closure variables.** Plugins load once per location, and reloads close the scope. In-memory state silently diverges or vanishes.
- **`opencode run "/cmd ..."` does not dispatch slash commands.** Test commands in the TUI, or via the API: `opencode api session.command --param sessionID=... -d '{"name":"<cmd>","text":"..."}'`.
- **The shell tool is named `shell`**, not `bash`. Its exit code is at `result.output.exit` in `execute.after`.
- **Register tools with `options: { codemode: false }`** so they are real tool definitions the model calls directly.
- **Tool names are rewritten.** Effective name is `<namespace>_<name>`; dots and unsupported characters become `_`. Use the effective name in `update`, `remove`, and `execute.before`/`after` checks.
- **Tool snapshots.** Each model request captures the tool set; `reload()` and `dispose` only affect later requests.
- **Session hooks must be retry-safe.** A request can be retried, and the hook runs again. Side effects in a hook (storage writes, prompts, counters) happen once per attempt.
- **`http.request` / `http.response` bodies are one-shot streams.** Clone or replace before reading.
- **TUI plugins need extra type packages.** A `tui.tsx` using JSX fails `tsc` ("requires the module path '@opentui/solid/jsx-runtime'") unless `@opentui/solid`, `@opentui/core`, `solid-js`, and `@opencode/theme` are installed. They are optional peers of `@opencode/plugin`: install as dev dependencies, matching the versions `@opencode/plugin` declares (`@opentui/*@0.6.6`, `@opencode/theme@2.1.2` for 2.1.2). The TUI host supplies them at runtime. Start the file with `/** @jsxImportSource @opentui/solid */`.
- **Plugin runs on the host's `effect`.** A dependency built on Effect 3 will break at runtime even if it type-checks against its own copy.
