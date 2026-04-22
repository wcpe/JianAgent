package top.wcpe.mc.plugin.jianagent.bridge

import com.google.gson.JsonElement
import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import top.wcpe.mc.plugin.jianagent.api.ProbeStatus
import top.wcpe.mc.plugin.jianagent.api.protocol.HandshakeResponse
import java.net.URI
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import java.util.logging.Logger

class WebSocketBridge(
    private val serverUri: String,
    private val pluginVersion: String,
    private val serverVersion: String,
    private val serverId: String,
    private val logger: Logger,
    private val onMessage: (String, JsonElement) -> Unit = { _, _ -> },
) : ProbeBridgeClient {
    override val status = BridgeStatus()
    private val reconnect = BridgeReconnect()
    private val handshake = BridgeHandshake(status, logger)
    private val scheduler: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor()
    @Volatile
    private var shutdownRequested = false

    private var client: WebSocketClient? = null

    override fun connect() {
        if (shutdownRequested) return
        if (status.current == ProbeStatus.READY || status.current == ProbeStatus.CONNECTING) return

        status.transition(ProbeStatus.CONNECTING)
        logger.info("[JianAgent] Connecting to $serverUri ...")

        client = object : WebSocketClient(URI(serverUri)) {
            override fun onOpen(handshakedata: ServerHandshake) {
                logger.info("[JianAgent] WS connected, sending handshake")
                val request = handshake.createRequest(pluginVersion, serverVersion, serverId)
                send(BridgeProtocol.serialize("plugin:handshake", request))
            }

            override fun onMessage(message: String) {
                try {
                    val msg = BridgeProtocol.deserialize(message)
                    when (msg.channel) {
                        "plugin:handshake" -> {
                            val resp = BridgeProtocol.parsePayload<HandshakeResponse>(msg)
                            if (handshake.handleResponse(resp)) {
                                reconnect.reset()
                            }
                        }
                        else -> {
                            if (status.isReady()) {
                                onMessage(msg.channel, msg.payload)
                            }
                        }
                    }
                } catch (e: Exception) {
                    logger.warning("[JianAgent] Failed to process message: ${e.message}")
                }
            }

            override fun onClose(code: Int, reason: String, remote: Boolean) {
                logger.info("[JianAgent] WS closed: $reason (code=$code)")
                if (shutdownRequested) {
                    status.transition(ProbeStatus.UNAVAILABLE)
                    return
                }
                status.transition(ProbeStatus.DISCONNECTED)
                scheduleReconnect()
            }

            override fun onError(ex: Exception) {
                if (shutdownRequested) {
                    return
                }
                logger.warning("[JianAgent] WS error: ${ex.message}")
            }
        }
        client?.connect()
    }

    override fun send(channel: String, payload: Any) {
        if (!status.isReady()) return
        val json = BridgeProtocol.serialize(channel, payload)
        client?.send(json)
    }

    override fun disconnect() {
        shutdownRequested = true
        client?.close()
        scheduler.shutdownNow()
        status.transition(ProbeStatus.UNAVAILABLE)
    }

    private fun scheduleReconnect() {
        if (shutdownRequested || scheduler.isShutdown || scheduler.isTerminated) {
            return
        }
        if (!reconnect.shouldReconnect()) {
            logger.warning("[JianAgent] Max reconnect retries reached, giving up")
            return
        }
        reconnect.recordFailure()
        val delay = reconnect.nextDelayMs()
        logger.info("[JianAgent] Reconnecting in ${delay}ms (attempt ${reconnect.retryCount})")
        runCatching {
            scheduler.schedule({ connect() }, delay, TimeUnit.MILLISECONDS)
        }.onFailure {
            logger.fine("[JianAgent] Reconnect scheduling skipped: ${it.message}")
        }
    }
}
