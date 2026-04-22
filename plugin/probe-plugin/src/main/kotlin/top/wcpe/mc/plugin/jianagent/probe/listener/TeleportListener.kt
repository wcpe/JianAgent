package jianagent.probe.listener

import org.bukkit.Location
import org.bukkit.event.player.PlayerTeleportEvent
import taboolib.common.platform.event.SubscribeEvent
import top.wcpe.mc.plugin.jianagent.ProbePlugin

/**
 * Captures player teleport events and reports them to the JianAgent server.
 */
object TeleportListener {

    @SubscribeEvent
    fun onPlayerTeleport(event: PlayerTeleportEvent) {
        val data = buildMap<String, Any> {
            put("player", event.player.name)
            put("from", locationToMap(event.from))
            event.to?.let { put("to", locationToMap(it)) }
            put("cause", event.cause.name)
        }

        val bridge = ProbePlugin.bridgeOrNull ?: return
        bridge.send("player_teleport", data)
    }

    private fun locationToMap(loc: Location): Map<String, Any> = mapOf(
        "x" to loc.x,
        "y" to loc.y,
        "z" to loc.z,
        "world" to (loc.world?.name ?: ""),
    )
}
