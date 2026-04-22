package top.wcpe.mc.plugin.jianagent.bridge

import top.wcpe.mc.plugin.jianagent.api.ProbeStatus
import top.wcpe.mc.plugin.jianagent.api.protocol.HandshakeRequest
import top.wcpe.mc.plugin.jianagent.api.protocol.HandshakeResponse
import top.wcpe.mc.plugin.jianagent.api.protocol.ProtocolVersion
import java.util.logging.Logger

class BridgeHandshake(
    private val bridgeStatus: BridgeStatus,
    private val logger: Logger,
) {
    fun createRequest(pluginVersion: String, serverVersion: String, serverId: String): HandshakeRequest {
        bridgeStatus.transition(ProbeStatus.HANDSHAKING)
        return HandshakeRequest(
            protocolVersion = ProtocolVersion.CURRENT,
            pluginVersion = pluginVersion,
            serverVersion = serverVersion,
            serverId = serverId,
        )
    }

    fun handleResponse(response: HandshakeResponse): Boolean {
        return if (response.accepted) {
            bridgeStatus.transition(ProbeStatus.READY)
            logger.info("[JianAgent] Handshake accepted — probe is READY")
            true
        } else {
            bridgeStatus.transition(ProbeStatus.VERSION_MISMATCH)
            logger.warning("[JianAgent] Handshake rejected: ${response.reason}")
            false
        }
    }
}
