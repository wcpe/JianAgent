package top.wcpe.mc.plugin.jianagent.listener

import org.bukkit.event.player.PlayerJoinEvent
import org.bukkit.event.player.PlayerQuitEvent
import org.bukkit.event.entity.PlayerDeathEvent
import org.bukkit.event.player.PlayerTeleportEvent
import taboolib.common.platform.event.SubscribeEvent

object PlayerEventListener {

    @SubscribeEvent
    fun onJoin(e: PlayerJoinEvent) {
        EventDispatcher.dispatch("PLAYER_JOIN", mapOf(
            "playerName" to e.player.name,
            "playerUuid" to e.player.uniqueId.toString(),
        ))
    }

    @SubscribeEvent
    fun onQuit(e: PlayerQuitEvent) {
        EventDispatcher.dispatch("PLAYER_QUIT", mapOf(
            "playerName" to e.player.name,
        ))
    }

    @SubscribeEvent
    fun onDeath(e: PlayerDeathEvent) {
        EventDispatcher.dispatch("PLAYER_DEATH", mapOf(
            "playerName" to e.entity.name,
            "deathMessage" to (e.deathMessage ?: ""),
        ))
    }

    @SubscribeEvent
    fun onTeleport(e: PlayerTeleportEvent) {
        EventDispatcher.dispatch("PLAYER_TELEPORT", mapOf(
            "playerName" to e.player.name,
            "from" to "${e.from.world?.name}:${e.from.blockX},${e.from.blockY},${e.from.blockZ}",
            "to" to "${e.to?.world?.name}:${e.to?.blockX},${e.to?.blockY},${e.to?.blockZ}",
        ))
    }
}
