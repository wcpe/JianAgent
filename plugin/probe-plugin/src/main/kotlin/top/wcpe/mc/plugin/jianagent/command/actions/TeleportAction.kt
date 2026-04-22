package top.wcpe.mc.plugin.jianagent.command.actions

import org.bukkit.Bukkit
import org.bukkit.Location
import top.wcpe.mc.plugin.jianagent.api.ProbeCommandResult

class TeleportAction : Action {
    override val actionId = "TELEPORT"

    override fun execute(params: Map<String, Any?>, requestId: String): ProbeCommandResult {
        val target = params["target"] as? String
            ?: return ProbeCommandResult(requestId, false, "Missing 'target' param")
        val x = (params["x"] as? Number)?.toDouble()
            ?: return ProbeCommandResult(requestId, false, "Missing 'x' param")
        val y = (params["y"] as? Number)?.toDouble()
            ?: return ProbeCommandResult(requestId, false, "Missing 'y' param")
        val z = (params["z"] as? Number)?.toDouble()
            ?: return ProbeCommandResult(requestId, false, "Missing 'z' param")
        val worldName = params["world"] as? String ?: "world"

        val player = Bukkit.getPlayer(target)
            ?: return ProbeCommandResult(requestId, false, "Player '$target' not found")
        val world = Bukkit.getWorld(worldName)
            ?: return ProbeCommandResult(requestId, false, "World '$worldName' not found")

        player.teleport(Location(world, x, y, z))
        return ProbeCommandResult(requestId, true, "Teleported $target to $x,$y,$z in $worldName")
    }
}
