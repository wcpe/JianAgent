package top.wcpe.mc.plugin.jianagent.listener

import org.bukkit.event.player.PlayerJoinEvent
import org.bukkit.event.player.PlayerQuitEvent
import org.bukkit.event.player.PlayerKickEvent
import org.bukkit.event.entity.PlayerDeathEvent
import taboolib.common.platform.event.SubscribeEvent

/**
 * Listens for events related to Mineflayer bots.
 * Bot detection: bots join with names matching the configured prefix pattern.
 */
object BotEventListener {

    private fun isBotName(name: String): Boolean {
        return name.matches(Regex("^[a-zA-Z]+_\\d{2,4}$"))
    }

    @SubscribeEvent
    fun onBotJoin(e: PlayerJoinEvent) {
        if (!isBotName(e.player.name)) return
        EventDispatcher.dispatch("BOT_JOIN", mapOf(
            "botName" to e.player.name,
        ))
    }

    @SubscribeEvent
    fun onBotQuit(e: PlayerQuitEvent) {
        if (!isBotName(e.player.name)) return
        EventDispatcher.dispatch("BOT_QUIT", mapOf(
            "botName" to e.player.name,
        ))
    }

    @SubscribeEvent
    fun onBotKick(e: PlayerKickEvent) {
        if (!isBotName(e.player.name)) return
        EventDispatcher.dispatch("BOT_KICKED", mapOf(
            "botName" to e.player.name,
            "reason" to e.reason,
        ))
    }

    @SubscribeEvent
    fun onBotDeath(e: PlayerDeathEvent) {
        if (!isBotName(e.entity.name)) return
        EventDispatcher.dispatch("BOT_DEATH", mapOf(
            "botName" to e.entity.name,
            "deathMessage" to (e.deathMessage ?: ""),
        ))
    }
}
