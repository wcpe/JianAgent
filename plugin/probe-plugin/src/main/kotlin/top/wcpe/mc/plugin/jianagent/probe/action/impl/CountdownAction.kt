package jianagent.probe.action.impl

import jianagent.probe.action.ActionResult
import jianagent.probe.action.ParamType
import jianagent.probe.action.WhitelistAction
import org.bukkit.Bukkit
import org.bukkit.scheduler.BukkitRunnable
import taboolib.platform.util.bukkitPlugin

class CountdownAction : WhitelistAction {
    override val name = "countdown"

    override val paramSchema = mapOf(
        "seconds" to ParamType.INT,
    )

    override fun execute(params: Map<String, Any>): ActionResult {
        val seconds = (params["seconds"] as? Number)?.toInt() ?: 5

        if (seconds < 1 || seconds > 60) {
            return ActionResult(false, "Seconds must be between 1 and 60")
        }

        object : BukkitRunnable() {
            var remaining = seconds

            override fun run() {
                if (remaining <= 0) {
                    Bukkit.getOnlinePlayers().forEach { p ->
                        p.sendTitle("§aGO!", "", 0, 20, 10)
                    }
                    cancel()
                    return
                }

                val color = when {
                    remaining <= 1 -> "§c"
                    remaining <= 3 -> "§e"
                    else -> "§a"
                }

                Bukkit.getOnlinePlayers().forEach { p ->
                    p.sendTitle("$color$remaining", "§7准备...", 0, 25, 0)
                }
                remaining--
            }
        }.runTaskTimer(bukkitPlugin, 0L, 20L)

        return ActionResult(true, "Countdown started: ${seconds}s")
    }
}
