package top.wcpe.mc.plugin.jianagent.command.actions

import top.wcpe.mc.plugin.jianagent.api.ProbeCommandResult

class StopGameAction : Action {
    override val actionId = "STOP_GAME"

    override fun execute(params: Map<String, Any?>, requestId: String): ProbeCommandResult {
        return ProbeCommandResult(requestId, true, "Game stopped")
    }
}
