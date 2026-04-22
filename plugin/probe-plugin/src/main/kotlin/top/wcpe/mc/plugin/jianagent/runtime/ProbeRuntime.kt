package top.wcpe.mc.plugin.jianagent.runtime

import com.google.gson.JsonElement
import top.wcpe.mc.plugin.jianagent.api.ProbeSnapshot
import top.wcpe.mc.plugin.jianagent.bridge.ProbeBridgeClient
import java.util.logging.Logger

class ProbeRuntime(
    private val logger: Logger,
    private val createBridge: (ProbeBootstrapConfig, Logger, (String, JsonElement) -> Unit) -> ProbeBridgeClient,
    private val createRouter: (ProbeBridgeClient) -> ProbeMessageRouter,
    private val snapshotScheduler: SnapshotScheduler,
    private val snapshotCollector: () -> ProbeSnapshot,
) {
    private var activeBridge: ProbeBridgeClient? = null
    private var snapshotTask: SnapshotTask? = null

    fun start(config: ProbeBootstrapConfig) {
        stop()

        var router: ProbeMessageRouter? = null
        val bridge = createBridge(
            config,
            logger,
            { channel: String, payload: JsonElement ->
                router?.route(channel, payload)
            },
        )
        router = createRouter(bridge)

        activeBridge = bridge
        snapshotTask = snapshotScheduler.schedule(config.snapshotIntervalTicks) {
            if (!bridge.status.isReady()) {
                return@schedule
            }

            try {
                bridge.send("plugin:snapshot", snapshotCollector())
            } catch (ex: Exception) {
                logger.warning("Snapshot dispatch failed: ${ex.message}")
            }
        }
        bridge.connect()
    }

    fun stop() {
        snapshotTask?.cancel()
        snapshotTask = null

        activeBridge?.disconnect()
        activeBridge = null
    }

    fun bridgeOrNull(): ProbeBridgeClient? = activeBridge
}