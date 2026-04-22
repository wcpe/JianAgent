package top.wcpe.mc.plugin.jianagent.api

data class WorldMetric(
    val name: String,
    val environment: String,
    val entityCount: Int,
    val loadedChunks: Int,
    val entityTypes: Map<String, Int>,
)

data class PlayerDetail(
    val name: String,
    val uuid: String,
    val health: Double,
    val maxHealth: Double,
    val food: Int,
    val level: Int,
    val gameMode: String,
    val world: String,
    val x: Double,
    val y: Double,
    val z: Double,
    val ping: Int,
)

data class PluginDetail(
    val name: String,
    val version: String,
    val enabled: Boolean,
    val authors: List<String>,
)

data class ProbeSnapshot(
    val tps: Double,
    val mspt: Double,
    val onlinePlayers: Int,
    val maxPlayers: Int,
    val loadedChunks: Int,
    val entityCount: Int,
    val worldCount: Int,
    val freeMemoryMb: Long,
    val totalMemoryMb: Long,
    val maxMemoryMb: Long,
    val cpuUsage: Double,
    val uptime: String,
    val timestamp: String,
    val playerNames: List<String>,
    val pluginCount: Int,
    val worlds: List<WorldMetric>,
    val players: List<PlayerDetail>,
    val plugins: List<PluginDetail>,
)
