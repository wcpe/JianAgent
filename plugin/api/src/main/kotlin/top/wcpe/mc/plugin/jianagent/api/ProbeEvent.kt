package top.wcpe.mc.plugin.jianagent.api

data class ProbeEvent(
    val eventType: String,
    val data: Map<String, Any?>,
    val timestamp: String,
)
