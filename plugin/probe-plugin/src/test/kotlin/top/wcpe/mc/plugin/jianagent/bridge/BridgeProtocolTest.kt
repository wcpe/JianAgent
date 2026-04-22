package top.wcpe.mc.plugin.jianagent.bridge

import org.junit.jupiter.api.Test
import top.wcpe.mc.plugin.jianagent.api.protocol.HandshakeRequest
import top.wcpe.mc.plugin.jianagent.api.protocol.ProtocolVersion
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class BridgeProtocolTest {
    @Test
    fun `serialize and deserialize round trip`() {
        val request = HandshakeRequest(
            pluginVersion = "1.0.0",
            serverVersion = "1.21.1",
            serverId = "srv_1",
        )
        val json = BridgeProtocol.serialize("plugin:handshake", request)
        val msg = BridgeProtocol.deserialize(json)

        assertEquals("plugin:handshake", msg.channel)
        assertEquals(ProtocolVersion.CURRENT, msg.protocolVersion)

        val parsed = BridgeProtocol.parsePayload<HandshakeRequest>(msg)
        assertEquals("1.0.0", parsed.pluginVersion)
        assertEquals("srv_1", parsed.serverId)
    }

    @Test
    fun `timestamp is included`() {
        val json = BridgeProtocol.serialize("test", mapOf("key" to "value"))
        val msg = BridgeProtocol.deserialize(json)
        assertTrue(msg.timestamp.isNotBlank())
    }
}
