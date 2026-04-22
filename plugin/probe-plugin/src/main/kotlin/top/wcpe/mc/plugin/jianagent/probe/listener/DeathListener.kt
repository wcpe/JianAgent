package jianagent.probe.listener

import org.bukkit.Location
import org.bukkit.event.entity.PlayerDeathEvent
import taboolib.common.platform.event.SubscribeEvent
import top.wcpe.mc.plugin.jianagent.ProbePlugin

/**
 * Captures player death events and reports them to the JianAgent server.
 */
object DeathListener {

    @SubscribeEvent
    fun onPlayerDeath(event: PlayerDeathEvent) {
        val player = event.entity
        val killer = player.killer
        val cause = player.lastDamageCause?.cause?.name ?: "UNKNOWN"

        val data = buildMap<String, Any> {
            put("player", player.name)
            put("killer", killer?.name ?: "unknown")
            put("cause", cause)
            put("location", locationToMap(player.location))
            put("deathMessage", event.deathMessage ?: "")
        }

        val bridge = ProbePlugin.bridgeOrNull ?: return
        bridge.send("player_death", data)
    }

    private fun locationToMap(loc: Location): Map<String, Any> = mapOf(
        "x" to loc.x,
        "y" to loc.y,
        "z" to loc.z,
        "world" to (loc.world?.name ?: ""),
    )
}
