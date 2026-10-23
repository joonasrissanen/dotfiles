import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import * as M from "./machine.ts"

const testing = () => M.enterTest(M.start("spec", 2), "test")

const observe = (workflow: M.Running, command: string, passed: boolean) => {
  const observed = M.observeShell(workflow, command, passed)
  if (observed === undefined) throw new Error(`not observed: ${command}`)
  return observed
}

const reviewing = () => {
  const outcome = M.testResult(observe(testing(), "bun test", true), 0)
  if (outcome.kind !== "review") throw new Error(`expected review, got ${outcome.kind}`)
  return outcome.workflow
}

describe("machine", () => {
  test("write -> test", () => {
    expect(testing().stage).toBe("test")
  })

  test("pass -> review -> clean -> verify -> complete", () => {
    const testRun = M.testResult(observe(testing(), "bun test", true), 0)
    expect(testRun.kind).toBe("review")
    expect(testRun.workflow.stage).toBe("review")

    const review = M.reviewResult(reviewing(), [])
    expect(review.kind).toBe("verify")
    expect(review.workflow.stage).toBe("verify")
    if (review.kind !== "verify") return

    const verify = M.testResult(observe(review.workflow, "npm run test", true), 0)
    expect(verify.kind).toBe("verified")
    if (verify.kind !== "verified") return
    expect(M.canComplete(verify.workflow)).toBe(true)

    const done = M.complete(verify.workflow)
    expect(done.active).toBe(false)
    expect(done.stage).toBe("done")
    expect(M.statusText(done)).toBe("No active workflow")
  })

  test("observed result overrides reported exit code", () => {
    const outcome = M.testResult(observe(testing(), "pytest -q", false), 0)
    expect(outcome.kind).toBe("fix")
    expect(outcome.note).toContain("disagreed")
  })

  test("agreeing observed result adds no note", () => {
    expect(M.testResult(observe(testing(), "go test ./...", true), 0).note).toBe("")
  })

  test("unobserved: trusts reported code and says so", () => {
    const outcome = M.testResult(testing(), 1)
    expect(outcome.kind).toBe("fix")
    expect(outcome.note).toContain("No test command")
  })

  test("non-test shell commands are ignored", () => {
    expect(M.observeShell(testing(), "ls -la", false)).toBeUndefined()
  })

  test("shell observed outside test stages is ignored", () => {
    expect(M.observeShell(M.start("spec"), "bun test", true)).toBeUndefined()
  })

  test("entering a test stage clears the previous observation", () => {
    expect(M.enterTest(observe(testing(), "bun test", true), "test").observedTest).toBeNull()
  })

  test("review issues -> fix; cap stops INCOMPLETE", () => {
    const review = M.reviewResult(reviewing(), ["a"]) // iteration 1 of max 2
    expect(review.kind).toBe("fix")
    expect(review.workflow.reviewIssues).toEqual(["a"])
    if (review.kind !== "fix") return

    const second = M.testResult(M.enterTest(review.workflow, "test"), 1) // iteration 2
    expect(second.kind).toBe("fix")
    if (second.kind !== "fix") return

    const third = M.testResult(M.enterTest(second.workflow, "test"), 1) // iteration 3 > 2
    expect(third.kind).toBe("stopped")
    expect(third.workflow.active).toBe(false)
    expect(third.workflow.incomplete).toBe(true)
    expect(M.statusText(third.workflow)).toContain("INCOMPLETE")
  })

  test("review issues at the cap stop the workflow", () => {
    const review = M.reviewResult({ ...reviewing(), iteration: 2 }, ["a"])
    expect(review.kind).toBe("stopped")
    expect(review.workflow.stage).toBe("fix")
  })

  test("guard rejects wrong stage and inactive", () => {
    const workflow = M.start("spec")
    expect(M.guard(workflow, "workflow_next", ["write", "fix"]).ok).toBe(true)
    expect(M.guard(workflow, "workflow_test_result", ["test", "verify"]).ok).toBe(false)
    expect(M.guard(M.cancel(workflow), "workflow_next", ["write"]).ok).toBe(false)
    expect(M.guard(undefined, "x", ["write"]).ok).toBe(false)
  })

  test("cannot complete before verify passes", () => {
    expect(M.canComplete(M.start("spec"))).toBe(false)
  })

  test("guidance includes spec and stage", () => {
    const text = M.guidance(M.start("spec"))
    expect(text).toContain("spec")
    expect(text).toContain("Writing implementation")
  })

  test("formatIssues numbers and caps the list", () => {
    const lines = M.formatIssues(Array.from({ length: 60 }, (_, i) => `issue ${i}`)).split("\n")
    expect(lines).toHaveLength(50)
    expect(lines[0]).toBe("1. issue 0")
  })
})

describe("stored workflow", () => {
  const decode = Schema.decodeUnknownSync(M.Workflow)
  const stored = {
    spec: "spec",
    iteration: 1,
    maxIterations: 10,
    testsPassed: false,
    observedTest: { passed: true, command: "bun test" },
    reviewIssues: ["a"],
  }

  test("decodes records written by the previous version", () => {
    expect(decode({ ...stored, active: true, incomplete: false, stage: "test" }).stage).toBe("test")
    expect(decode({ ...stored, active: false, incomplete: true, stage: "fix" }).incomplete).toBe(true)
    expect(decode({ ...stored, active: false, incomplete: false, stage: "done" }).stage).toBe("done")
    expect(decode({ ...stored, active: false, incomplete: false, stage: "review" }).active).toBe(false)
  })

  test("round-trips through encode", () => {
    const workflow = M.start("spec")
    expect(decode(Schema.encodeSync(M.Workflow)(workflow))).toEqual(workflow)
  })

  test("rejects impossible states", () => {
    expect(() => decode({ ...stored, active: true, incomplete: false, stage: "done" })).toThrow()
    expect(() => decode({ ...stored, active: true, incomplete: true, stage: "fix" })).toThrow()
    expect(() => decode({ ...stored, active: false, incomplete: true, stage: "write" })).toThrow()
  })
})
