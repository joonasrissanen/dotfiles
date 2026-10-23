/**
 * context-workflow for OpenCode v2.
 *
 *   /workflow <spec text | path/to/spec.md>   start
 *   /workflow status                          show state
 *   /workflow cancel                          cancel
 *
 * write -> test -> isolated review (child session) -> fix -> test -> verify -> done
 * Tests are judged by the real shell exit code, not the model's word.
 */
import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { resolve } from "node:path"
import { Plugin } from "@opencode/plugin/effect"
import { Tool } from "@opencode/schema/tool"
import type { Session } from "@opencode/schema/session"
import { Effect, Option, Schema, Stream } from "effect"
import * as M from "./machine.ts"
import { WorkflowRpc } from "./rpc.ts"

// `review/<child session>` holds `{ open: true }` while the reviewer runs, then its report.
const PendingReview = Schema.Struct({ open: Schema.Literal(true) })
const ReportedReview = Schema.Struct({
  open: Schema.Literal(true),
  issues: Schema.Array(Schema.String),
  summary: Schema.optionalKey(Schema.String),
})

// Idle-guard reminders sent for the current `stage:iteration`.
const Nudge = Schema.Struct({ key: Schema.String, count: Schema.Number })
const MAX_NUDGES = 3

const reviewKey = (sessionID: string) => `review/${sessionID}`

export default Plugin.define({
  id: "local.context-workflow",
  effect: (ctx) =>
    Effect.gen(function* () {
      // Storage is the source of truth: several plugin instances (one per location)
      // can exist in one server, so nothing is cached in memory.
      const load = Effect.fnUntraced(function* (sessionID: string): Effect.fn.Return<M.Workflow | undefined> {
        const raw = yield* ctx.storage.get(`wf/${sessionID}`)
        if (raw === undefined) return undefined
        return yield* Schema.decodeUnknownEffect(M.Workflow)(raw).pipe(
          // A record this version cannot read is treated as no workflow; starting a new one overwrites it.
          Effect.catch((error) =>
            Effect.logWarning("ignoring unreadable workflow record", { sessionID, error }).pipe(Effect.as(undefined)),
          ),
        )
      })

      const rpc = yield* ctx.rpc
        .register(WorkflowRpc, {
          status: ({ sessionID }) =>
            load(sessionID).pipe(
              Effect.map((workflow) =>
                workflow === undefined
                  ? {
                      active: false,
                      incomplete: false,
                      stage: "none",
                      label: "No active workflow",
                      iteration: 0,
                      maxIterations: 0,
                      openIssues: 0,
                    }
                  : {
                      active: workflow.active,
                      incomplete: workflow.incomplete,
                      stage: workflow.stage,
                      label: M.statusText(workflow),
                      iteration: workflow.iteration,
                      maxIterations: workflow.maxIterations,
                      openIssues: workflow.reviewIssues.length,
                    },
              ),
            ),
        })
        .pipe(Effect.orDie)

      const save = Effect.fnUntraced(function* (sessionID: string, workflow: M.Workflow) {
        yield* ctx.storage.set(`wf/${sessionID}`, Schema.encodeSync(M.Workflow)(workflow))
        // The TUI may not be open; a missed status refresh is harmless.
        yield* rpc.events.emit("updated", { sessionID }).pipe(Effect.ignore)
      })

      const say = (sessionID: Session.ID, text: string) =>
        ctx.session.synthetic({ sessionID, text }).pipe(Effect.asVoid)

      yield* ctx.command.transform((editor) => {
        editor.add({
          name: "workflow",
          description: "Context-isolated workflow: /workflow <spec|file.md> | status | cancel",
          execute: ({ sessionID, prompt, delivery }) =>
            Effect.gen(function* () {
              const arg = prompt.text.trim()
              const workflow = yield* load(sessionID)

              if (arg === "status") {
                if (workflow === undefined) return yield* say(sessionID, "No workflow in this session.")
                return yield* say(
                  sessionID,
                  [
                    `Stage: ${M.statusText(workflow)}`,
                    `Tests: ${workflow.testsPassed ? "passing" : "not passing"}`,
                    `Open review issues: ${workflow.reviewIssues.length}`,
                  ].join("\n"),
                )
              }
              if (arg === "cancel") {
                if (workflow?.active !== true) return yield* say(sessionID, "No active workflow to cancel.")
                yield* save(sessionID, M.cancel(workflow))
                return yield* say(sessionID, "Workflow cancelled.")
              }
              if (workflow?.active) {
                return yield* say(sessionID, "A workflow is already active. Use `/workflow cancel` first.")
              }
              if (arg === "") return yield* say(sessionID, "Usage: /workflow <spec text | path/to/spec.md>")

              const spec = /^[^\s]+\.(md|txt)$/i.test(arg)
                ? yield* Effect.tryPromise(() =>
                    readFile(resolve(ctx.location.directory, arg.replace(/^~/, homedir())), "utf-8"),
                  ).pipe(Effect.option)
                : Option.some(arg)
              if (Option.isNone(spec)) return yield* say(sessionID, `Could not find spec file: ${arg}`)
              if (spec.value.trim() === "") return yield* say(sessionID, "Spec is empty.")

              yield* save(sessionID, M.start(spec.value))
              yield* ctx.session.prompt({
                sessionID,
                text: "Implement the feature described in the workflow spec (see workflow guidance). Create all necessary files and tests. When done, call workflow_next to proceed to testing.",
                delivery,
              })
            }),
        })
      })

      // Re-applied on every request, so the guidance survives compaction.
      yield* ctx.session.hook("context", (event) =>
        Effect.gen(function* () {
          const workflow = yield* load(event.sessionID)
          if (workflow?.active) event.system.push({ type: "text", text: M.guidance(workflow) })
        }),
      )

      // Observe real test runs.
      yield* ctx.tool.hook("execute.after", (event) =>
        Effect.gen(function* () {
          if (event.tool !== "shell" && event.tool !== "bash") return
          const workflow = yield* load(event.sessionID)
          if (workflow?.active !== true) return
          const input = Schema.decodeUnknownOption(Schema.Struct({ command: Schema.String }))(event.input)
          if (Option.isNone(input)) return
          const decodeExit = Schema.decodeUnknownOption(Schema.Struct({ exit: Schema.Number }))
          const passed =
            event.status === "completed" &&
            decodeExit(event.result.output).pipe(
              Option.orElse(() => decodeExit(event.result.metadata)),
              Option.exists((result) => result.exit === 0),
            )
          const observed = M.observeShell(workflow, input.value.command, passed)
          if (observed !== undefined) yield* save(event.sessionID, observed)
        }),
      )

      const runIsolatedReview = Effect.fnUntraced(function* (
        parentID: Session.ID,
        spec: string,
      ): Effect.fn.Return<typeof ReportedReview.Type | undefined, unknown> {
        const parent = yield* ctx.session.get({ sessionID: parentID })
        const child = yield* ctx.session.create({
          parentID,
          title: "Workflow review (isolated)",
          location: { directory: parent.location.directory },
          model: parent.model,
          permissions: [
            { action: "edit", resource: "*", effect: "deny" },
            { action: "write", resource: "*", effect: "deny" },
          ],
        })
        const changes = yield* ctx.vcs.status().pipe(
          Effect.map((status) => JSON.stringify(status).slice(0, 4000)),
          // The change list is only a starting hint; the prompt tells the reviewer to inspect the directory without it.
          Effect.orElseSucceed(() => ""),
        )

        yield* ctx.storage.set(reviewKey(child.id), Schema.encodeSync(PendingReview)({ open: true }))
        return yield* Effect.gen(function* () {
          for (const text of [
            M.reviewPrompt(spec, changes),
            "You have not reported yet. Call the workflow_review_result tool now with your findings.",
          ]) {
            yield* ctx.session.prompt({ sessionID: child.id, text })
            yield* ctx.session.wait({ sessionID: child.id })
            // Still pending (no report yet) does not decode as a report.
            const report = Schema.decodeUnknownOption(ReportedReview)(yield* ctx.storage.get(reviewKey(child.id)))
            if (Option.isSome(report)) return report.value
          }
          return undefined
        }).pipe(
          // Interrupted tool call (user abort): stop the reviewer too. It may already be idle.
          Effect.onInterrupt(() => ctx.session.interrupt({ sessionID: child.id }).pipe(Effect.ignore)),
          Effect.ensuring(ctx.storage.remove(reviewKey(child.id))),
        )
      })

      yield* ctx.tool.transform((editor) => {
        editor.add({
          name: "workflow_next",
          description: "Finish the write or fix stage and move on to testing.",
          input: Schema.Struct({
            notes: Schema.optionalKey(Schema.String.annotate({ description: "Notes about what was completed" })),
          }),
          options: { codemode: false },
          execute: (_input, context) =>
            Effect.gen(function* () {
              const checked = M.guard(yield* load(context.sessionID), "workflow_next", ["write", "fix"])
              if (!checked.ok) return { content: `ERROR: ${checked.message}` }
              yield* save(context.sessionID, M.enterTest(checked.workflow, "test"))
              return {
                content:
                  "Moving to testing. Run the project's full test suite with the shell tool (directly, no piping, so the exit code is preserved). Then call workflow_test_result.",
              }
            }),
        })

        editor.add({
          name: "workflow_test_result",
          description:
            "Report the result of the test run. The plugin uses the exit status it observed from the shell tool when available. On a pass, an independent review runs and its findings are returned.",
          input: Schema.Struct({
            exitCode: Schema.Finite.annotate({ description: "Exit code from the test command (0 = pass)" }),
            output: Schema.optionalKey(Schema.String.annotate({ description: "Test output summary" })),
          }),
          options: { codemode: false },
          execute: ({ exitCode, output }, context) =>
            Effect.gen(function* () {
              const checked = M.guard(yield* load(context.sessionID), "workflow_test_result", ["test", "verify"])
              if (!checked.ok) return { content: `ERROR: ${checked.message}` }

              const outcome = M.testResult(checked.workflow, exitCode)
              const note = outcome.note === "" ? "" : `\nNote: ${outcome.note}`
              yield* save(context.sessionID, outcome.workflow)

              if (outcome.kind === "stopped") {
                return {
                  content: `Tests failed and the fix-iteration limit (${outcome.workflow.maxIterations}) was reached. Workflow stopped: INCOMPLETE. Tell the user.${note}`,
                }
              }
              if (outcome.kind === "fix") {
                const detail = output ? `\n\nOutput:\n${output.slice(0, 500)}` : ""
                return {
                  content: `Tests failed. Inspect the output, fix the code, then call workflow_next to re-run tests.${detail}${note}`,
                }
              }
              if (outcome.kind === "verified") {
                return { content: `Final verification passed. Call workflow_complete with a summary.${note}` }
              }

              yield* context.progress({ status: "Running isolated review..." })
              const retryReview = save(context.sessionID, M.enterTest(outcome.workflow, "test"))
              const review = yield* runIsolatedReview(context.sessionID, outcome.workflow.spec).pipe(
                // Failed or aborted: leave "review", or the workflow is stuck there until cancelled.
                Effect.onError(() => retryReview),
                Effect.mapError(
                  (error) =>
                    new Tool.Error({
                      message:
                        "The isolated review failed. Re-run the tests and call workflow_test_result again to retry the review.",
                      error,
                    }),
                ),
              )
              if (review === undefined) {
                yield* retryReview
                return {
                  content: `The isolated review did not complete (no result reported). Re-run the tests and call workflow_test_result again to retry the review.${note}`,
                }
              }

              const summary = review.summary ? `\n\nReviewer summary: ${review.summary}` : ""
              const result = M.reviewResult(outcome.workflow, review.issues)
              yield* save(context.sessionID, result.workflow)
              if (result.kind === "verify") {
                return {
                  content: `Review passed with no issues. Final verification: run the full test suite one more time with the shell tool (directly, no piping), then call workflow_test_result.${summary}`,
                }
              }
              const issues = M.formatIssues(review.issues)
              if (result.kind === "fix") {
                return {
                  content: `Independent review found ${review.issues.length} issue(s):\n${issues}\n\nFix them, then call workflow_next to re-test.${summary}`,
                }
              }
              return {
                content: `Review found issues but the fix-iteration limit (${result.workflow.maxIterations}) was reached. Workflow stopped: INCOMPLETE. Tell the user.\n${issues}${summary}`,
              }
            }),
        })

        editor.add({
          name: "workflow_review_result",
          description:
            "ONLY for the isolated reviewer session: report code review findings (empty issues array if none). Do not call this as the implementer.",
          input: Schema.Struct({
            issues: Schema.Array(Schema.String).annotate({ description: "Issues found (empty array if none)" }),
            summary: Schema.optionalKey(Schema.String.annotate({ description: "Overall review summary" })),
          }),
          options: { codemode: false },
          execute: (input, context) =>
            Effect.gen(function* () {
              if ((yield* ctx.storage.get(reviewKey(context.sessionID))) === undefined) {
                return { content: "ERROR: workflow_review_result is only valid inside the isolated reviewer session." }
              }
              yield* ctx.storage.set(
                reviewKey(context.sessionID),
                Schema.encodeSync(ReportedReview)({ ...input, open: true }),
              )
              return { content: "Review recorded. You are done; do not take any further action." }
            }),
        })

        editor.add({
          name: "workflow_complete",
          description: "Mark the workflow complete. Only valid after final verification tests passed.",
          input: Schema.Struct({
            summary: Schema.String.annotate({ description: "Summary of what was accomplished" }),
          }),
          options: { codemode: false },
          execute: ({ summary }, context) =>
            Effect.gen(function* () {
              const workflow = yield* load(context.sessionID)
              if (workflow?.active !== true) return { content: "ERROR: No active workflow" }
              if (!M.canComplete(workflow)) {
                return {
                  content: "ERROR: workflow_complete requires a passing final verification test run (stage verify).",
                }
              }
              yield* save(context.sessionID, M.complete(workflow))
              return {
                content: [
                  "Workflow complete.",
                  summary,
                  `Fix iterations: ${workflow.iteration}`,
                  "Tests: passing. Review issues: resolved.",
                ].join("\n"),
              }
            }),
        })
      })

      // Idle guard: if the model ends its turn mid-workflow, nudge it.
      yield* ctx.event.subscribe().pipe(
        Stream.runForEach((event) =>
          Effect.gen(function* () {
            if (event.type !== "session.execution.succeeded") return
            const sessionID = event.data.sessionID
            const workflow = yield* load(sessionID)
            if (workflow?.active !== true || workflow.stage === "review") return
            // Every location's plugin instance sees the event; only the session's own location reacts.
            const session = yield* ctx.session.get({ sessionID })
            if (session.location.directory !== ctx.location.directory) return

            const key = `${workflow.stage}:${workflow.iteration}`
            const raw = yield* ctx.storage.get(`nudge/${sessionID}`)
            const previous = raw === undefined ? undefined : yield* Schema.decodeUnknownEffect(Nudge)(raw)
            const count = previous?.key === key ? previous.count : 0
            if (count >= MAX_NUDGES) {
              yield* say(
                sessionID,
                `Workflow stalled in stage "${workflow.stage}" after ${MAX_NUDGES} reminders. Use \`/workflow cancel\` or continue manually.`,
              )
              return yield* save(sessionID, M.cancel(workflow))
            }
            yield* ctx.storage.set(`nudge/${sessionID}`, Schema.encodeSync(Nudge)({ key, count: count + 1 }))
            yield* ctx.session.prompt({
              sessionID,
              text: `The workflow is still active (stage: ${M.STAGE_LABEL[workflow.stage]}). Next action: ${M.expectedAction(workflow.stage)}.`,
            })
          }).pipe(
            // A failed nudge for one session must not stop the guard for the others.
            Effect.catch((error) => Effect.logWarning("workflow idle guard failed", { event: event.type, error })),
          ),
        ),
        Effect.catch((error) => Effect.logWarning("workflow idle guard stopped: event stream failed", { error })),
        Effect.forkScoped,
      )
    }),
})
