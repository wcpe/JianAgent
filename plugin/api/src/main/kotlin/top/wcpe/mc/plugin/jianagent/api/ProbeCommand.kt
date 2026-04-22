package top.wcpe.mc.plugin.jianagent.api

data class ProbeCommand(
    val action: String,
    val params: Map<String, Any?>,
    val requestId: String,
)

data class ProbeCommandResult(
    val requestId: String,
    val success: Boolean,
    val message: String? = null,
    val data: Map<String, Any?>? = null,
)
