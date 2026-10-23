/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { type WorkflowStatus, WorkflowRpc } from "./rpc.ts"

/**
 * Status line for the context-workflow server plugin. Auto-loaded as the sibling
 * tui.* of index.ts. Pulls status over the plugin's RPC and refreshes on its
 * `updated` event.
 */
export default Plugin.define({
  id: "local.context-workflow.tui",
  setup(ctx) {
    const [state, update] = ctx.storage.memory<Record<string, WorkflowStatus>>("status", { initial: {} })
    const rpc = ctx.client.rpc(WorkflowRpc)
    const requested = new Set<string>()

    const refresh = (sessionID: string) =>
      rpc.status({ sessionID }).then(
        (status) =>
          update((draft) => {
            draft[sessionID] = status
          }),
        // Server plugin not loaded for this location: leave the line empty.
        () => undefined,
      )

    const stop = rpc.events.on("updated", (event) => refresh(event.data.sessionID))

    const dispose = ctx.ui.slot({
      append: "prompt.footer.status",
      render: (input) => {
        const sessionID = input.sessionID
        if (sessionID !== undefined && !requested.has(sessionID)) {
          requested.add(sessionID)
          void refresh(sessionID)
        }
        const current = () => (sessionID === undefined ? undefined : state[sessionID])
        const label = () => {
          const status = current()
          return status !== undefined && (status.active || status.incomplete) ? ` workflow: ${status.label}` : ""
        }
        const color = () =>
          current()?.incomplete
            ? ctx.theme.text.feedback.error.base
            : current()?.stage === "review"
              ? ctx.theme.text.feedback.warning.base
              : ctx.theme.text.base
        return <text fg={color()}>{label()}</text>
      },
    })

    return () => {
      stop()
      dispose()
    }
  },
})
