/**
 * Pure state machine for the context-isolated workflow. No opencode imports.
 *
 *   write/fix --workflow_next--------> test
 *   test      --workflow_test_result-> review (pass) | fix (fail)
 *   review    (isolated child session)-> verify (no issues) | fix (issues)
 *   verify    --workflow_test_result-> pass: workflow_complete | fix (fail)
 *
 * Reaching the fix-iteration cap stops the workflow as INCOMPLETE.
 */
import { Schema } from "effect"

const RunningStage = Schema.Literals(["write", "test", "review", "fix", "verify"])

const progress = {
  spec: Schema.String,
  /** Number of fix cycles started. */
  iteration: Schema.Number,
  maxIterations: Schema.Number,
  testsPassed: Schema.Boolean,
  /** Result of a recognised test command seen in the current test/verify stage. */
  observedTest: Schema.NullOr(Schema.Struct({ passed: Schema.Boolean, command: Schema.String })),
  reviewIssues: Schema.Array(Schema.String),
}

// Stored records are flat objects with `active`/`incomplete` flags. The union keeps that
// shape so existing records still decode, and rules out flag/stage combinations that
// cannot happen.
export const Workflow = Schema.Union([
  Schema.Struct({ active: Schema.Literal(true), incomplete: Schema.Literal(false), stage: RunningStage, ...progress }),
  // Stopped by the fix-iteration cap.
  Schema.Struct({ active: Schema.Literal(false), incomplete: Schema.Literal(true), stage: Schema.Literal("fix"), ...progress }),
  // Completed (stage "done") or cancelled (any other stage).
  Schema.Struct({
    active: Schema.Literal(false),
    incomplete: Schema.Literal(false),
    stage: Schema.Literals([...RunningStage.literals, "done"]),
    ...progress,
  }),
])
export type Workflow = typeof Workflow.Type
export type Running = Extract<Workflow, { active: true }>
type Stopped = Extract<Workflow, { incomplete: true }>
type Stage = Workflow["stage"]

export const STAGE_LABEL: Record<Stage, string> = {
  write: "Writing implementation",
  test: "Running tests",
  review: "Code review (isolated)",
  fix: "Fixing issues",
  verify: "Final verification",
  done: "Complete",
}

const MAX_ISSUES_IN_PROMPT = 50

const TEST_COMMAND =
  /\b(pytest|vitest|jest|cargo\s+test|go\s+test|mvn\s+test|gradle\s+test|make\s+test|(npm|pnpm|yarn|bun)\s+(run\s+)?test|mise\s+(run\s+)?test(:[\w:-]+)?)(?![\w:-])/i

export function start(spec: string, maxIterations = 10): Running {
  return {
    active: true,
    incomplete: false,
    stage: "write",
    spec,
    iteration: 0,
    maxIterations,
    testsPassed: false,
    observedTest: null,
    reviewIssues: [],
  }
}

export function expectedAction(stage: Stage): string {
  switch (stage) {
    case "write":
    case "fix":
      return "finish the work, then call workflow_next"
    case "test":
    case "verify":
      return "run the project's test command with the shell tool (directly, no piping, so the exit code is preserved), then call workflow_test_result"
    case "review":
      return "wait: the isolated review is running"
    case "done":
      return "none"
  }
}

export function statusText(workflow: Workflow): string {
  if (workflow.active) return `${STAGE_LABEL[workflow.stage]} (fix ${workflow.iteration}/${workflow.maxIterations})`
  return workflow.incomplete ? "Workflow stopped (INCOMPLETE)" : "No active workflow"
}

export function guidance(workflow: Running): string {
  return [
    "---",
    "CONTEXT-ISOLATED WORKFLOW ACTIVE",
    `Stage: ${STAGE_LABEL[workflow.stage]} (fix iteration ${workflow.iteration}/${workflow.maxIterations})`,
    `Next action: ${expectedAction(workflow.stage)}`,
    "",
    "Workflow spec:",
    workflow.spec,
    "---",
  ].join("\n")
}

/** Records a shell result; `undefined` unless it is a recognised test command run in test/verify. */
export function observeShell(workflow: Running, command: string, passed: boolean): Running | undefined {
  if (workflow.stage !== "test" && workflow.stage !== "verify") return undefined
  if (!TEST_COMMAND.test(command)) return undefined
  return { ...workflow, observedTest: { passed, command: command.slice(0, 200) } }
}

type Guard = { ok: true; workflow: Running } | { ok: false; message: string }

export function guard(workflow: Workflow | undefined, tool: string, allowed: ReadonlyArray<Stage>): Guard {
  if (workflow?.active !== true) return { ok: false, message: "No active workflow" }
  if (!allowed.includes(workflow.stage)) {
    return {
      ok: false,
      message: `${tool} is not valid in stage "${workflow.stage}". Expected action: ${expectedAction(workflow.stage)}`,
    }
  }
  return { ok: true, workflow }
}

function enterFix(workflow: Running): Running | Stopped {
  const iteration = workflow.iteration + 1
  if (iteration > workflow.maxIterations) {
    return { ...workflow, active: false, incomplete: true, stage: "fix", iteration, testsPassed: false }
  }
  return { ...workflow, stage: "fix", iteration, testsPassed: false }
}

export function enterTest(workflow: Running, stage: "test" | "verify"): Running {
  return { ...workflow, stage, testsPassed: false, observedTest: null }
}

type TestOutcome =
  | { kind: "fix"; note: string; workflow: Running }
  | { kind: "stopped"; note: string; workflow: Stopped }
  | { kind: "review"; note: string; workflow: Running }
  | { kind: "verified"; note: string; workflow: Running }

/** Applies a test report. The observed shell result wins over the model-supplied exit code. */
export function testResult(workflow: Running, exitCode: number): TestOutcome {
  const observed = workflow.observedTest
  const reported = exitCode === 0
  const passed = observed === null ? reported : observed.passed
  const note =
    observed === null
      ? "No test command was observed this stage; trusting the reported exit code."
      : observed.passed === reported
        ? ""
        : `Reported exit code disagreed with the observed result of \`${observed.command}\`; using the observed result.`

  if (!passed) {
    const next = enterFix(workflow)
    return next.active ? { kind: "fix", note, workflow: next } : { kind: "stopped", note, workflow: next }
  }
  if (workflow.stage === "verify") return { kind: "verified", note, workflow: { ...workflow, testsPassed: true } }
  return { kind: "review", note, workflow: { ...workflow, stage: "review", testsPassed: true, reviewIssues: [] } }
}

type ReviewOutcome =
  | { kind: "verify"; workflow: Running }
  | { kind: "fix"; workflow: Running }
  | { kind: "stopped"; workflow: Stopped }

export function reviewResult(workflow: Running, issues: ReadonlyArray<string>): ReviewOutcome {
  const reviewed = { ...workflow, reviewIssues: issues }
  if (issues.length === 0) return { kind: "verify", workflow: enterTest(reviewed, "verify") }
  const next = enterFix(reviewed)
  return next.active ? { kind: "fix", workflow: next } : { kind: "stopped", workflow: next }
}

export function canComplete(workflow: Running): boolean {
  return workflow.stage === "verify" && workflow.testsPassed
}

export function complete(workflow: Running): Workflow {
  return { ...workflow, active: false, stage: "done" }
}

export function cancel(workflow: Running): Workflow {
  return { ...workflow, active: false }
}

export function formatIssues(issues: ReadonlyArray<string>): string {
  return issues
    .slice(0, MAX_ISSUES_IN_PROMPT)
    .map((issue, i) => `${i + 1}. ${issue}`)
    .join("\n")
}

export function reviewPrompt(spec: string, changes: string): string {
  return [
    "You are an independent code reviewer. You did NOT write this code and have no prior context.",
    "Review the implementation against the spec below. Read the changed files (use git status / git diff and the read tool).",
    "Check: correctness vs spec, code quality, test coverage, edge cases, error handling, best practices.",
    "Do NOT modify any files.",
    "When finished, call the workflow_review_result tool exactly once with your findings (empty issues array if none).",
    "",
    "## Spec",
    spec,
    "",
    "## Changes (starting point; verify yourself)",
    changes || "(no git changes detected; inspect the project directory)",
  ].join("\n")
}
