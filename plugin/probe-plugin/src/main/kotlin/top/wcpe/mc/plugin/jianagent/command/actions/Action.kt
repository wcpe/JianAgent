package top.wcpe.mc.plugin.jianagent.command.actions

import top.wcpe.mc.plugin.jianagent.api.ProbeCommandResult

interface Action {
    val actionId: String
    fun execute(params: Map<String, Any?>, requestId: String): ProbeCommandResult
}
