package top.wcpe.mc.plugin.jianagent.command.actions

import top.wcpe.mc.plugin.jianagent.api.ProbeCommandResult

class ForceStartAction : Action {
    override val actionId = "FORCE_START"

    override fun execute(params: Map<String, Any?>, requestId: String): ProbeCommandResult {
        return ProbeCommandResult(requestId, true, "Force start triggered")
    }
}
