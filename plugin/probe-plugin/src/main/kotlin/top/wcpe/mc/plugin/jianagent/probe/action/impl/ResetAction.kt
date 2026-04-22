package jianagent.probe.action.impl

import jianagent.probe.action.ActionResult
import jianagent.probe.action.ParamType
import jianagent.probe.action.WhitelistAction
import org.bukkit.Bukkit

class ResetAction : WhitelistAction {
    override val name = "reset_map"

    override val paramSchema = mapOf(
        "worldName" to ParamType.STRING,
    )

    override fun execute(params: Map<String, Any>): ActionResult {
        val worldName = params["worldName"] as? String
            ?: return ActionResult(false, "Missing worldName parameter")

        val world = Bukkit.getWorld(worldName)

        if (world != null) {
            // Kick players from the world before unloading
            for (player in world.players) {
                val spawn = Bukkit.getWorlds().firstOrNull { it.name != worldName }?.spawnLocation
                if (spawn != null) player.teleport(spawn)
            }
            val unloaded = Bukkit.unloadWorld(world, false)
            if (!unloaded) {
                return ActionResult(false, "Failed to unload world '$worldName'")
            }
        }

        // The actual backup-restore logic is server-specific and should be
        // handled by a file copy operation. This action signals intent only.
        return ActionResult(
            true,
            "World '$worldName' unloaded for reset. Restore backup and reload.",
            mapOf("worldName" to worldName),
        )
    }
}
