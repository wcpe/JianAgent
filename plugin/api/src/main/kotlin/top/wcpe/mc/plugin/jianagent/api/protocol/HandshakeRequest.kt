package top.wcpe.mc.plugin.jianagent.api.protocol

data class HandshakeRequest(
    val protocolVersion: Int = ProtocolVersion.CURRENT,
    val pluginVersion: String,
    val serverVersion: String,
    val serverId: String,
)
