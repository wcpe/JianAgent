package top.wcpe.mc.plugin.jianagent.snapshot

import top.wcpe.mc.plugin.jianagent.ProbePlugin
import java.util.logging.Logger

object SnapshotCollector {

    private val logger = Logger.getLogger("JianAgent")

    fun dispatchSnapshot() {
        val bridge = ProbePlugin.bridgeOrNull ?: return
        if (!bridge.status.isReady()) return

        try {
            bridge.send("plugin:snapshot", ServerSnapshot.collect())
        } catch (e: Exception) {
            logger.warning("[JianAgent] Snapshot collection failed: ${e.message}")
        }
    }
}
