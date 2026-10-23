import { Rpc } from "@opencode/plugin/rpc"
import { Schema } from "effect"

// Standard Schema keeps the definition portable to the TUI client and types both ends.
const SessionRef = Schema.toStandardSchemaV1(Schema.Struct({ sessionID: Schema.String }))

const WorkflowStatus = Schema.Struct({
  active: Schema.Boolean,
  incomplete: Schema.Boolean,
  stage: Schema.String,
  label: Schema.String,
  iteration: Schema.Number,
  maxIterations: Schema.Number,
  openIssues: Schema.Number,
})
export type WorkflowStatus = typeof WorkflowStatus.Type

/** Server -> TUI channel for the status line. */
export const WorkflowRpc = Rpc.define({
  id: "local.context-workflow",
  methods: {
    status: { input: SessionRef, output: Schema.toStandardSchemaV1(WorkflowStatus) },
  },
  events: {
    updated: { schema: SessionRef },
  },
})
