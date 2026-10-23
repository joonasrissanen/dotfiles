# context-workflow (OpenCode v2)

You describe a feature; the agent builds it, runs the tests, gets an independent review,
fixes problems and re-verifies, without prompting at every step.

```
/workflow <spec text | path/to/spec.md>   start (relative paths resolve against the location directory)
/workflow status                          show state
/workflow cancel                          cancel
```

Flow: `write -> test -> review -> fix -> test -> verify -> done`

- **Tests are judged by the real shell exit code** (`tool` hook `execute.after`), not by what
  the model claims. A mismatch is reported and the observed result wins.
- **Review is isolated.** On a passing test run the plugin creates a child session that has only
  the spec and the changed-file list (no implementation history), with `edit`/`write` denied, and
  runs the review there. Only the findings return to the main session. If the review fails or the
  tool call is aborted, the reviewer is interrupted and the workflow returns to `test`.
- **Cap:** more than 10 fix cycles stops the workflow as INCOMPLETE.
- **Idle guard:** if the model ends its turn mid-workflow it is reminded of the next action
  (max 3 reminders per stage, then the workflow is stopped).
- **Status line:** `tui.tsx` shows the stage in the prompt footer (reads the server plugin over RPC).

## Files

| file | role |
|---|---|
| `machine.ts` | pure state machine and the stored `Workflow` schema (tested: `bun test plugins/context-workflow`) |
| `index.ts` | Effect plugin (`@opencode/plugin/effect`): tools, `/workflow` command, context guidance, review, idle guard |
| `rpc.ts` | RPC contract server <-> TUI (Effect Schema via Standard Schema, typed on both ends) |
| `tui.tsx` | footer status line (auto-loaded as sibling of `index.ts`) |

Storage keys (plugin-scoped): `wf/<sessionID>` workflow, `review/<childSessionID>` reviewer report
while a review runs, `nudge/<sessionID>` idle-guard reminder count.

Auto-loaded from `~/.config/opencode/plugins/`. Restart the background server after edits:
`opencode service restart`.

## Notes / gotchas learned on v2 (2.1.2)

- `opencode run "/workflow ..."` does not dispatch slash commands; use the TUI, or
  `opencode api session.command --param sessionID=... -d '{"name":"workflow","text":"..."}'`.
- Plugins load once per location, so state lives in plugin storage, never in memory.
- The shell tool is named `shell` (exit code at `result.output.exit`).
- Tools are registered with `codemode: false` so they are real tool definitions.
- Type-checking `tui.tsx` needs `@opentui/solid` (an optional peer of `@opencode/plugin`) installed.
