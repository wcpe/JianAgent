package top.wcpe.mc.plugin.jianagent

import com.google.gson.JsonElement
import taboolib.common.LifeCycle
import taboolib.common.platform.Awake
import taboolib.common.platform.Plugin
import taboolib.platform.util.bukkitPlugin
import top.wcpe.mc.plugin.jianagent.bridge.MessageRouter
import top.wcpe.mc.plugin.jianagent.bridge.ProbeBridgeClient
import top.wcpe.mc.plugin.jianagent.bridge.WebSocketBridge
import top.wcpe.mc.plugin.jianagent.command.CommandProxy
import top.wcpe.mc.plugin.jianagent.runtime.BukkitSnapshotScheduler
import top.wcpe.mc.plugin.jianagent.runtime.ProbeBootstrapConfig
import top.wcpe.mc.plugin.jianagent.runtime.ProbeRuntime
import top.wcpe.mc.plugin.jianagent.snapshot.ServerSnapshot

object ProbePlugin : Plugin() {
    @Volatile
    private var runtime: ProbeRuntime? = null

    val instance: ProbePlugin
        get() = this

    val bridge: ProbeBridgeClient
        get() = bridgeOrNull ?: error("Probe bridge is not initialized")

    val bridgeOrNull: ProbeBridgeClient?
        get() = runtime?.bridgeOrNull()

    @Awake(LifeCycle.ENABLE)
    fun enable() {
        bukkitPlugin.saveDefaultConfig()
        val logger = bukkitPlugin.logger
        val config = loadBootstrapConfig()

        runtime?.stop()
        runtime = ProbeRuntime(
            logger = logger,
            createBridge = { runtimeConfig: ProbeBootstrapConfig, bridgeLogger: java.util.logging.Logger, incoming: (String, JsonElement) -> Unit ->
                WebSocketBridge(
                    serverUri = runtimeConfig.serverUri,
                    pluginVersion = runtimeConfig.pluginVersion,
                    serverVersion = runtimeConfig.serverVersion,
                    serverId = runtimeConfig.serverId,
                    logger = bridgeLogger,
                    onMessage = incoming,
                )
            },
            createRouter = { bridgeClient: ProbeBridgeClient ->
                MessageRouter(
                    bridge = bridgeClient,
                    commandProxy = CommandProxy(),
                    mainThreadDispatcher = BukkitSnapshotScheduler::execute,
                )
            },
            snapshotScheduler = BukkitSnapshotScheduler,
            snapshotCollector = ServerSnapshot::collect,
        ).also {
            it.start(config)
        }

        logger.info("Probe plugin enabled")
    }

    @Awake(LifeCycle.DISABLE)
    fun disable() {
        runtime?.stop()
        runtime = null
        bukkitPlugin.logger.info("Probe plugin disabled")
    }

    private fun loadBootstrapConfig(): ProbeBootstrapConfig {
        val pluginConfig = bukkitPlugin.config
        val logger = bukkitPlugin.logger
        val host = readString("bridge.host", "localhost")
        val port = readPort(pluginConfig.getInt("bridge.port", 3401), logger)
        val serverId = readString("bridge.server-id", "default")
        val snapshotIntervalTicks = pluginConfig.getLong("snapshot.interval-ticks", 100L)
            .takeIf { it > 0L } ?: 100L

        return ProbeBootstrapConfig(
            serverUri = "ws://$host:$port",
            pluginVersion = bukkitPlugin.description.version,
            serverVersion = bukkitPlugin.server.version,
            serverId = serverId,
            snapshotIntervalTicks = snapshotIntervalTicks,
        )
    }

    private fun readString(path: String, fallback: String): String {
        return bukkitPlugin.config.getString(path)?.trim()?.takeIf { it.isNotEmpty() } ?: fallback
    }

    private fun readPort(configuredPort: Int, logger: java.util.logging.Logger): Int {
        if (configuredPort in 1..65535) {
            return configuredPort
        }
        logger.warning("Invalid bridge.port '$configuredPort', using 3401")
        return 3401
    }
}
