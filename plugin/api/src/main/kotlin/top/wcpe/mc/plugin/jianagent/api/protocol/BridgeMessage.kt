package top.wcpe.mc.plugin.jianagent.api.protocol

import com.google.gson.JsonElement
import java.time.Instant

data class BridgeMessage(
    val channel: String,
    val protocolVersion: Int = ProtocolVersion.CURRENT,
    val payload: JsonElement,
    val timestamp: String = Instant.now().toString(),
)
