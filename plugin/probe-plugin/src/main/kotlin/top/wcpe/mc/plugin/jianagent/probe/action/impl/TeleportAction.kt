package jianagent.probe.action.impl

import jianagent.probe.action.ActionResult
import jianagent.probe.action.ParamType
import jianagent.probe.action.WhitelistAction
import org.bukkit.Bukkit
import org.bukkit.Location

class TeleportAction : WhitelistAction {
    override val name = "teleport"

    override val paramSchema = mapOf(
        "target" to ParamType.PLAYER_NAME,
        "x" to ParamType.DOUBLE,
        "y" to ParamType.DOUBLE,
        "z" to ParamType.DOUBLE,
        "world" to ParamType.STRING,
    )

    override fun execute(params: Map<String, Any>): ActionResult {
        val targetName = params["target"] as? String
            ?: return ActionResult(false, "Missing target player name")
        val player = Bukkit.getPlayerExact(targetName)
            ?: return ActionResult(false, "Player '$targetName' not found or offline")

        val worldName = params["world"] as? String ?: player.world.name
        val world = Bukkit.getWorld(worldName)
            ?: return ActionResult(false, "World '$worldName' not found")

        val x = (params["x"] as? Number)?.toDouble() ?: player.location.x
        val y = (params["y"] as? Number)?.toDouble() ?: player.location.y
        val z = (params["z"] as? Number)?.toDouble() ?: player.location.z

        val dest = Location(world, x, y, z)
        player.teleport(dest)

        return ActionResult(
            true,
            "Teleported $targetName to ${worldName}($x, $y, $z)",
            mapOf("x" to x, "y" to y, "z" to z, "world" to worldName),
        )
    }
}
