package top.wcpe.mc.plugin.jianagent.bridge

import com.google.gson.Gson
import top.wcpe.mc.plugin.jianagent.api.protocol.BridgeMessage
import top.wcpe.mc.plugin.jianagent.api.protocol.ProtocolVersion

object BridgeProtocol {
    @PublishedApi
    internal val gson = Gson()

    fun serialize(channel: String, payload: Any): String {
        val payloadJson = gson.toJsonTree(payload)
        val msg = BridgeMessage(
            channel = channel,
            protocolVersion = ProtocolVersion.CURRENT,
            payload = payloadJson,
        )
        return gson.toJson(msg)
    }

    fun deserialize(raw: String): BridgeMessage {
        return gson.fromJson(raw, BridgeMessage::class.java)
    }

    inline fun <reified T> parsePayload(msg: BridgeMessage): T {
        return gson.fromJson(msg.payload, T::class.java)
    }
}
