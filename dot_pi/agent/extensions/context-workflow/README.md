# context-workflow

## In plain English

You describe what you want built. The AI then builds it, checks its own work, and
fixes problems, without you having to prompt it at every step. Think of it as a small
assembly line with a quality check:

1. **Build it.** The AI writes the code and the tests for it.
2. **Try it.** The AI runs the tests. The extension looks at the real result
   (pass or fail), rather than trusting the AI's word for it.
3. **Get a second opinion.** If the tests pass, the AI's working memory of how it built
   things is wiped and replaced with a short summary. It then reviews the work like a
   fresh reviewer who didn't write it, which makes it less likely to approve its own mistakes.
4. **Fix what was found.** Any failed tests or review comments are sent back for fixing,
   then the tests run again.
5. **Final check.** Once the review is clean, the tests run one more time. If they pass, it's done.

If it can't get things right after 10 rounds of fixing, it stops and tells you it is
**not finished**, so it never loops forever or claims success it hasn't earned.

**What you do:** type `/workflow` followed by your description (or a file name), then watch.
The bottom bar shows which step it is on. Type `/workflow:cancel` to stop at any time.

**Good to know:** it creates and edits files in your project and runs your test command,
so use it in a project you're comfortable with the AI changing (ideally under git).
It works best when your description says what to build and how to run the tests.

---

## Technical details

Source: https://github.com/owainlewis/pi-extensions (modified for this pi install).

## Usage

```
/workflow spec.md            # spec from file (relative to cwd, ~ allowed)
/workflow Build X with tests # spec from text
/workflow                    # opens an editor
/workflow:status             # stage, fix count, test state, open issues
/workflow:cancel             # stop
```

Put your test command in the spec (e.g. "run tests with `npm test`").

## The stages

There are 5 working stages. The "10" in the footer, e.g. `(2/10)`, is **not** a step count:
it is the **fix-iteration limit** (`maxIterations`), see below.

| # | Stage | What happens | Moves on when |
|---|-------|--------------|---------------|
| 1 | **Write** | Model implements the spec and tests | Model calls `workflow_next` → Test |
| 2 | **Test** | Model runs the test command with bash | `workflow_test_result`: pass → Review, fail → Fix |
| 3 | **Review** | Context is compacted, then the model reviews the code (no edits) | `workflow_review_result`: no issues → Verify, issues → Fix |
| 4 | **Fix** | Model fixes test failures or review issues | Model calls `workflow_next` → Test |
| 5 | **Verify** | Model runs the full tests one last time | `workflow_test_result` pass → `workflow_complete` → Done; fail → Fix |

```
Write → Test ─pass→ Review ─no issues→ Verify ─pass→ Done
          ↑  └fail┐    └─issues─┐        └─fail┐
          └── Fix ←┴────────────┴─────────────┘
```

Happy path: Write, Test, Review, Verify (4 stages, 0 fix iterations).

## The limit of 10

`maxIterations = 10` counts **fix cycles**: each time the workflow enters the Fix stage
(from a failed test run or from review issues) the counter goes up by one. The 11th
attempt stops the workflow and reports it as **INCOMPLETE** (it is never reported as success).
Change it in `index.ts` (`maxIterations: 10`).

## Notes

- Test pass/fail comes from the observed bash result of a recognised test command
  (pytest, vitest, jest, cargo/go/mvn/gradle/make test, npm/pnpm/yarn/bun test, mise test / mise run test[:task]). The
  model-reported exit code is only a fallback. Don't pipe the test command (it masks the exit code).
- Compaction is done by pi-blackhole when installed (deterministic, ignores the custom instructions).
- The full spec is injected into the system prompt every turn so it survives compaction.
- If compaction fails, review proceeds with full context and a warning.
- Tools used by the model: `workflow_next`, `workflow_test_result`, `workflow_review_result`, `workflow_complete`.
