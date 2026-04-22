package jianagent.probe.listener

import org.bukkit.event.player.PlayerKickEvent
import taboolib.common.platform.event.SubscribeEvent
import top.wcpe.mc.plugin.jianagent.ProbePlugin

/**
 * Captures player kick events and reports them to the JianAgent server.
 */
object KickListener {

    @SubscribeEvent
    fun onPlayerKick(event: PlayerKickEvent) {
        val data = mapOf<String, Any>(
            "player" to event.player.name,
            "reason" to (event.reason ?: ""),
        )

        val bridge = ProbePlugin.bridgeOrNull ?: return
        bridge.send("player_kick", data)
    }
}
