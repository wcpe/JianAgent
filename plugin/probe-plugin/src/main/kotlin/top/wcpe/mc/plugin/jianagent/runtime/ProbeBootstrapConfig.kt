package top.wcpe.mc.plugin.jianagent.runtime

data class ProbeBootstrapConfig(
    val serverUri: String,
    val pluginVersion: String,
    val serverVersion: String,
    val serverId: String,
    val snapshotIntervalTicks: Long,
)