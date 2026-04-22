package top.wcpe.mc.plugin.jianagent.command.actions

import top.wcpe.mc.plugin.jianagent.api.ProbeCommandResult
import top.wcpe.mc.plugin.jianagent.snapshot.ServerSnapshot

class SnapshotAction : Action {
    override val actionId = "SNAPSHOT"

    override fun execute(params: Map<String, Any?>, requestId: String): ProbeCommandResult {
        return try {
            val snapshot = ServerSnapshot.collect()
            ProbeCommandResult(
                requestId = requestId,
                success = true,
                message = "Snapshot collected",
                data = mapOf(
                    "tps" to snapshot.tps,
                    "mspt" to snapshot.mspt,
                    "onlinePlayers" to snapshot.onlinePlayers,
                    "entityCount" to snapshot.entityCount,
                    "loadedChunks" to snapshot.loadedChunks,
                ),
            )
        } catch (e: Exception) {
            ProbeCommandResult(requestId, false, "Snapshot failed: ${e.message}")
        }
    }
}
