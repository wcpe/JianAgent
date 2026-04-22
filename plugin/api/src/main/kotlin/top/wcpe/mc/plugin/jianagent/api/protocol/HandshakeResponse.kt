package top.wcpe.mc.plugin.jianagent.api.protocol

data class HandshakeResponse(
    val accepted: Boolean,
    val reason: String? = null,
)
