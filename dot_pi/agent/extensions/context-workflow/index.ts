/**
 * Context-Isolated Workflow Extension
 *
 * write -> test -> (compact) review -> fix -> test -> verify -> done
 *
 * Transitions are driven by the tools, not by "call workflow_next" follow-ups:
 *   write/fix --workflow_next--------> test
 *   test      --workflow_test_result-> review (pass, context compacted) | fix (fail)
 *   review    --workflow_review_result-> verify (no issues) | fix (issues)
 *   verify    --workflow_test_result-> pass: call workflow_complete | fail: fix
 *
 * Test outcomes are observed from the real bash tool result (non-zero exit = isError);
 * the model-supplied exitCode is only a fallback when no test command was observed.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

type WorkflowStage = "write" | "test" | "review" | "fix" | "verify" | "done";

interface Workflow {
  active: boolean;
  stage: WorkflowStage;
  spec: string;
  /** Number of fix cycles started. */
  iteration: number;
  maxIterations: number;
  testsPassed: boolean;
  /** Test outcome seen from an actual bash test command in the current test/verify stage. */
  observedTest: { passed: boolean; command: string } | null;
  reviewIssues: string[];
  contextCompacted: boolean;
}

const STATE_TYPE = "context-workflow-state";

const STAGE_DESCRIPTIONS: Record<WorkflowStage, string> = {
  write: "📝 Writing implementation",
  test: "🧪 Running tests",
  review: "🔍 Code review (clean context)",
  fix: "🔧 Fixing issues",
  verify: "✅ Final verification",
  done: "🎉 Complete",
};

const TEST_CMD =
  /\b(pytest|vitest|jest|cargo\s+test|go\s+test|mvn\s+test|gradle\s+test|make\s+test|(npm|pnpm|yarn|bun)\s+(run\s+)?test|mise\s+(run\s+)?test(:[\w:-]+)?)(?![\w:-])/i;

const MAX_ISSUES_FIX_PROMPT = 50;

export default function (pi: ExtensionAPI) {
  let workflow: Workflow | null = null;

  const persist = () => {
    if (workflow) pi.appendEntry(STATE_TYPE, workflow);
  };

  const updateStatus = (ctx: ExtensionContext) => {
    if (workflow?.active) {
      ctx.ui.setStatus(
        "context-workflow",
        `${STAGE_DESCRIPTIONS[workflow.stage]} (${workflow.iteration}/${workflow.maxIterations})`,
      );
    } else {
      ctx.ui.setStatus("context-workflow", undefined);
    }
  };

  const text = (t: string, isError = false) => ({
    content: [{ type: "text" as const, text: t }],
    details: {},
    ...(isError ? { isError: true } : {}),
  });

  const noWorkflow = () => text("❌ No active workflow", true);
  const wrongStage = (tool: string, w: Workflow) =>
    text(`❌ ${tool} is not valid in stage "${w.stage}". Expected action for this stage: ${expectedAction(w.stage)}`, true);

  function expectedAction(stage: WorkflowStage): string {
    switch (stage) {
      case "write":
      case "fix":
        return "finish the work, then call workflow_next";
      case "test":
      case "verify":
        return "run the project's test command with bash, then call workflow_test_result";
      case "review":
        return "review the code, then call workflow_review_result";
      default:
        return "none";
    }
  }

  const finish = (ctx: ExtensionContext, reason?: string) => {
    if (!workflow) return;
    workflow.active = false;
    persist();
    updateStatus(ctx);
    if (reason) ctx.ui.notify(reason, "warning");
  };

  /** Move to the fix stage, enforcing the iteration limit. Returns false if the limit stopped the workflow. */
  const enterFix = (ctx: ExtensionContext, prompt: string): boolean => {
    const w = workflow!;
    w.iteration++;
    if (w.iteration > w.maxIterations) {
      w.stage = "fix";
      finish(ctx, `Workflow stopped: reached ${w.maxIterations} fix iterations without finishing (INCOMPLETE).`);
      return false;
    }
    w.stage = "fix";
    w.contextCompacted = false;
    persist();
    updateStatus(ctx);
    void pi.sendUserMessage(prompt, { deliverAs: "followUp" });
    return true;
  };

  const enterTest = (ctx: ExtensionContext, stage: "test" | "verify") => {
    const w = workflow!;
    w.stage = stage;
    w.testsPassed = false;
    w.observedTest = null;
    w.contextCompacted = false;
    persist();
    updateStatus(ctx);
  };

  // Restore state
  pi.on("session_start", async (_event, ctx) => {
    workflow = null;
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "custom" && entry.customType === STATE_TYPE) {
        workflow = entry.data as Workflow;
      }
    }
    if (workflow?.active) {
      updateStatus(ctx);
      ctx.ui.notify(
        `Resumed workflow at stage "${workflow.stage}". Send a message to continue it, or /workflow:cancel.`,
        "info",
      );
    }
  });

  function readSpec(arg: string): string | null {
    const trimmed = arg.trim();
    if (/^[^\s]+\.(md|txt)$/i.test(trimmed)) {
      const p = resolve(trimmed.startsWith("~") ? trimmed.replace(/^~/, homedir()) : trimmed);
      if (existsSync(p)) return readFileSync(p, "utf-8");
      return null;
    }
    return trimmed;
  }

  pi.registerCommand("workflow", {
    description: "Start context-isolated workflow (spec file or description)",
    handler: async (args, ctx) => {
      if (workflow?.active) {
        ctx.ui.notify("A workflow is already active. Use /workflow:cancel first.", "warning");
        return;
      }

      let spec = args?.trim() ?? "";
      if (spec) {
        const read = readSpec(spec);
        if (read === null) {
          ctx.ui.notify(`Could not find spec file: ${spec}`, "error");
          return;
        }
        spec = read;
      } else {
        spec =
          (await ctx.ui.editor(
            "Enter feature description or spec:",
            "# Feature\n\nDescribe what to build, including the tests required.",
          )) ?? "";
      }
      if (!spec.trim()) {
        ctx.ui.notify("Description required", "error");
        return;
      }

      workflow = {
        active: true,
        stage: "write",
        spec,
        iteration: 0,
        maxIterations: 10,
        testsPassed: false,
        observedTest: null,
        reviewIssues: [],
        contextCompacted: false,
      };
      persist();
      updateStatus(ctx);

      pi.sendMessage({
        customType: "context-workflow",
        content: `🚀 **Context-Isolated Workflow Started**\n\n\`\`\`\n${spec}\n\`\`\`\n\n**Stage 1: ${STAGE_DESCRIPTIONS.write}**`,
        display: true,
      });

      void pi.sendUserMessage(
        "Implement the feature described in the workflow spec. Create all necessary files and tests. When done, call workflow_next to proceed to testing.",
        { deliverAs: "followUp" },
      );
    },
  });

  pi.registerCommand("workflow:status", {
    description: "Check workflow status",
    handler: async (_args, ctx) => {
      if (!workflow?.active) {
        ctx.ui.notify("No active workflow", "info");
        return;
      }
      pi.sendMessage({
        customType: "context-workflow",
        content: [
          `**Stage**: ${STAGE_DESCRIPTIONS[workflow.stage]}`,
          `**Fix iterations**: ${workflow.iteration}/${workflow.maxIterations}`,
          `**Tests**: ${workflow.testsPassed ? "✅ Passing" : "❌ Not passing"}`,
          `**Open review issues**: ${workflow.reviewIssues.length}`,
          `**Context**: ${workflow.contextCompacted ? "Compacted (clean)" : "Full"}`,
        ].join("\n"),
        display: true,
      });
    },
  });

  pi.registerCommand("workflow:cancel", {
    description: "Cancel the workflow",
    handler: async (_args, ctx) => {
      if (!workflow?.active) {
        ctx.ui.notify("No active workflow to cancel", "info");
        return;
      }
      finish(ctx);
      ctx.ui.notify("Workflow cancelled", "info");
      workflow = null;
    },
  });

  // write/fix -> test
  pi.registerTool({
    name: "workflow_next",
    label: "Progress Workflow",
    description: "Finish the write or fix stage and move on to testing.",
    parameters: Type.Object({
      notes: Type.Optional(Type.String({ description: "Notes about what was completed" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const w = workflow;
      if (!w?.active) return noWorkflow();
      if (w.stage !== "write" && w.stage !== "fix") return wrongStage("workflow_next", w);

      enterTest(ctx, "test");
      void pi.sendUserMessage(
        "Run the project's full test suite with the bash tool (run the test command directly, do not pipe it through other commands, so the exit code is preserved). Then call workflow_test_result.",
        { deliverAs: "followUp" },
      );
      return { ...text("✅ Moving to testing."), details: { stage: "test", notes: params.notes } };
    },
  });

  // test/verify -> review | fix | (verify passed)
  pi.registerTool({
    name: "workflow_test_result",
    label: "Report Test Result",
    description:
      "Report the result of the test run. The extension uses the exit status it observed from the bash tool when available.",
    parameters: Type.Object({
      exitCode: Type.Number({ description: "Exit code from the test command (0 = pass)" }),
      output: Type.Optional(Type.String({ description: "Test output summary" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const w = workflow;
      if (!w?.active) return noWorkflow();
      if (w.stage !== "test" && w.stage !== "verify") return wrongStage("workflow_test_result", w);

      let passed = params.exitCode === 0;
      let note = "";
      if (w.observedTest) {
        if (w.observedTest.passed !== passed) {
          note = `\n⚠️ Reported exit code disagreed with the observed result of \`${w.observedTest.command}\`; using observed result.`;
        }
        passed = w.observedTest.passed;
      } else {
        note = "\n⚠️ No test command was observed this stage; trusting the reported exit code.";
      }
      w.testsPassed = passed;

      const fromVerify = w.stage === "verify";
      const detail = !passed && params.output ? `\n\nOutput:\n${params.output.slice(0, 500)}` : "";

      if (!passed) {
        const ok = enterFix(
          ctx,
          "Tests failed. Inspect the test output, fix the code, then call workflow_next to re-run tests.",
        );
        return text(
          (ok ? "❌ Tests failed. Moving to fix stage." : "⛔ Tests failed and the iteration limit was reached; workflow stopped (INCOMPLETE).") +
            detail +
            note,
        );
      }

      if (fromVerify) {
        persist();
        void pi.sendUserMessage("Final verification passed. Call workflow_complete with a summary.", {
          deliverAs: "followUp",
        });
        return text("✅ Final verification passed. Call workflow_complete." + note);
      }

      // test passed -> review with compacted context
      w.stage = "review";
      w.reviewIssues = [];
      w.contextCompacted = false;
      persist();
      updateStatus(ctx);

      const reviewPrompt =
        "You are now reviewing with fresh eyes. Using the spec in the workflow guidance, read the files that were created or changed (use git status/diff if available) and check: code quality, test coverage, edge cases, error handling, best practices. Do not modify files. Call workflow_review_result with your findings (empty issues array if none).";

      ctx.compact({
        customInstructions:
          "Keep only: 1) the original spec, 2) the list of files created or changed, 3) a brief summary of what was implemented. Drop implementation details and debugging history.",
        onComplete: () => {
          if (workflow?.active && workflow.stage === "review") {
            workflow.contextCompacted = true;
            persist();
            void pi.sendUserMessage(reviewPrompt, { deliverAs: "followUp" });
          }
        },
        onError: (error) => {
          if (!workflow?.active || workflow.stage !== "review") return;
          ctx.ui.notify(`Compaction failed: ${error.message}. Review will use FULL context (biased).`, "warning");
          void pi.sendUserMessage(`Note: context compaction failed, so this review is NOT isolated. ${reviewPrompt}`, {
            deliverAs: "followUp",
          });
        },
      });

      return text("✅ Tests passed. Compacting context for an unbiased review..." + note);
    },
  });

  // review -> verify | fix
  pi.registerTool({
    name: "workflow_review_result",
    label: "Report Review Result",
    description: "Report code review findings (empty issues array if none).",
    parameters: Type.Object({
      issues: Type.Array(Type.String(), { description: "Issues found (empty array if none)" }),
      summary: Type.Optional(Type.String({ description: "Overall review summary" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const w = workflow;
      if (!w?.active) return noWorkflow();
      if (w.stage !== "review") return wrongStage("workflow_review_result", w);

      w.reviewIssues = params.issues;
      const summary = params.summary ? `\n\n**Summary**: ${params.summary}` : "";

      if (params.issues.length === 0) {
        enterTest(ctx, "verify");
        void pi.sendUserMessage(
          "Run the full test suite one final time with bash (directly, no piping), then call workflow_test_result.",
          { deliverAs: "followUp" },
        );
        return text("✅ Review passed. Moving to final verification." + summary);
      }

      const list = params.issues
        .slice(0, MAX_ISSUES_FIX_PROMPT)
        .map((issue, i) => `${i + 1}. ${issue}`)
        .join("\n");
      const ok = enterFix(
        ctx,
        `Fix these issues from the code review:\n${list}\n\nWhen done, call workflow_next to re-test.`,
      );
      return text(
        (ok
          ? `📋 Review found ${params.issues.length} issue(s). Moving to fix stage:\n${list}`
          : "⛔ Review found issues and the iteration limit was reached; workflow stopped (INCOMPLETE).") + summary,
      );
    },
  });

  // verify -> done
  pi.registerTool({
    name: "workflow_complete",
    label: "Complete Workflow",
    description: "Mark the workflow complete. Only valid after final verification tests passed.",
    parameters: Type.Object({
      summary: Type.String({ description: "Summary of what was accomplished" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const w = workflow;
      if (!w?.active) return noWorkflow();
      if (w.stage !== "verify" || !w.testsPassed) {
        return text("❌ workflow_complete requires a passing final verification test run (stage verify).", true);
      }

      w.stage = "done";
      finish(ctx);

      return {
        ...text(
          [
            "🎉 **Workflow Complete!**",
            "",
            params.summary,
            "",
            `**Fix iterations**: ${w.iteration}`,
            "**Tests**: ✅ passing",
            "**Review issues**: ✅ resolved",
          ].join("\n"),
        ),
        details: { summary: params.summary },
      };
    },
  });

  // Inject workflow guidance (full spec always included so it survives compaction)
  pi.on("before_agent_start", async (event) => {
    if (!workflow?.active) return {};
    const w = workflow;
    const guidance = [
      "",
      "---",
      "**CONTEXT-ISOLATED WORKFLOW ACTIVE**",
      `Stage: ${STAGE_DESCRIPTIONS[w.stage]} (fix iteration ${w.iteration}/${w.maxIterations})`,
      `Next action: ${expectedAction(w.stage)}`,
      w.stage === "review"
        ? "You are reviewing objectively. Do not assume the code is correct because you may have written it."
        : "",
      "",
      "Workflow spec:",
      w.spec,
      "---",
    ].join("\n");
    return { systemPrompt: event.systemPrompt + guidance };
  });

  // Observe real test runs. bash reports non-zero exit as isError.
  pi.on("tool_result", async (event) => {
    if (!workflow?.active || (workflow.stage !== "test" && workflow.stage !== "verify")) return;
    if (event.toolName !== "bash") return;
    const command = typeof event.input?.command === "string" ? event.input.command : "";
    if (!TEST_CMD.test(command)) return;
    workflow.observedTest = { passed: !event.isError, command: command.slice(0, 200) };
  });

  pi.on("session_shutdown", async () => {
    workflow = null;
  });
}
