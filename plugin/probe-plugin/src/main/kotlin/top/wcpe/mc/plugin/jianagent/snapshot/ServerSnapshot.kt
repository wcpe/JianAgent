package top.wcpe.mc.plugin.jianagent.snapshot

import org.bukkit.Bukkit
import org.bukkit.Server
import top.wcpe.mc.plugin.jianagent.api.PlayerDetail
import top.wcpe.mc.plugin.jianagent.api.PluginDetail
import top.wcpe.mc.plugin.jianagent.api.ProbeSnapshot
import top.wcpe.mc.plugin.jianagent.api.WorldMetric
import java.lang.management.ManagementFactory
import java.time.Duration
import java.time.Instant

object ServerSnapshot {

    fun collect(): ProbeSnapshot {
        val server = Bukkit.getServer()
        val runtime = Runtime.getRuntime()
        val uptime = Duration.ofMillis(ManagementFactory.getRuntimeMXBean().uptime)
        val tps = readTps(server)
        val mspt = readMspt(server, tps)
        val cpuUsage = readCpuUsage()

        val worlds = server.worlds.map { world ->
            val entityTypes = mutableMapOf<String, Int>()
            for (entity in world.entities) {
                val typeName = entity.type.name
                entityTypes[typeName] = (entityTypes[typeName] ?: 0) + 1
            }
            WorldMetric(
                name = world.name,
                environment = world.environment.name,
                entityCount = world.entities.size,
                loadedChunks = world.loadedChunks.size,
                entityTypes = entityTypes,
            )
        }

        val players = server.onlinePlayers.map { player ->
            val ping = runCatching {
                player.javaClass.getMethod("getPing").invoke(player) as? Int
            }.getOrNull() ?: runCatching {
                val spigotMethod = player.javaClass.getMethod("spigot")
                val spigot = spigotMethod.invoke(player)
                spigot.javaClass.getMethod("getPing").invoke(spigot) as? Int
            }.getOrNull() ?: -1

            PlayerDetail(
                name = player.name,
                uuid = player.uniqueId.toString(),
                health = player.health,
                maxHealth = player.maxHealth,
                food = player.foodLevel,
                level = player.level,
                gameMode = player.gameMode.name,
                world = player.world.name,
                x = player.location.x,
                y = player.location.y,
                z = player.location.z,
                ping = ping,
            )
        }

        val plugins = server.pluginManager.plugins.map { plugin ->
            PluginDetail(
                name = plugin.name,
                version = plugin.description.version,
                enabled = plugin.isEnabled,
                authors = plugin.description.authors,
            )
        }

        return ProbeSnapshot(
            tps = tps,
            mspt = mspt,
            onlinePlayers = server.onlinePlayers.size,
            maxPlayers = server.maxPlayers,
            loadedChunks = worlds.sumOf { it.loadedChunks },
            entityCount = worlds.sumOf { it.entityCount },
            worldCount = worlds.size,
            freeMemoryMb = runtime.freeMemory() / (1024 * 1024),
            totalMemoryMb = runtime.totalMemory() / (1024 * 1024),
            maxMemoryMb = runtime.maxMemory() / (1024 * 1024),
            cpuUsage = cpuUsage,
            uptime = String.format("%02d:%02d:%02d", uptime.toHours(), uptime.toMinutesPart(), uptime.toSecondsPart()),
            timestamp = Instant.now().toString(),
            playerNames = server.onlinePlayers.map { it.name },
            pluginCount = server.pluginManager.plugins.size,
            worlds = worlds,
            players = players,
            plugins = plugins,
        )
    }

    private fun readCpuUsage(): Double {
        val osBean = ManagementFactory.getOperatingSystemMXBean()

        // Try getProcessCpuLoad (Java 8 com.sun), getCpuLoad (Java 9+), then getSystemCpuLoad as fallback
        val methodNames = listOf("getProcessCpuLoad", "getCpuLoad", "getSystemCpuLoad")
        for (name in methodNames) {
            val cpuLoad = runCatching {
                val method = osBean.javaClass.getMethod(name)
                method.isAccessible = true
                (method.invoke(osBean) as? Number)?.toDouble()
            }.getOrNull()
            val value = cpuLoad?.takeIf { it.isFinite() && it >= 0.0 }?.times(100.0)
            if (value != null) return value
        }
        return -1.0
    }

    private fun readTps(server: Server): Double {
        val rawTps = runCatching {
            server.javaClass.methods
                .firstOrNull { it.name == "getTPS" && it.parameterCount == 0 }
                ?.invoke(server)
        }.getOrNull()

        val tps = when (rawTps) {
            is DoubleArray -> rawTps.firstOrNull()
            is Array<*> -> (rawTps.firstOrNull() as? Number)?.toDouble()
            is Number -> rawTps.toDouble()
            else -> null
        }

        return tps?.takeIf { it.isFinite() && it > 0.0 } ?: 20.0
    }

    private fun readMspt(server: Server, tps: Double): Double {
        val rawMspt = runCatching {
            server.javaClass.methods
                .firstOrNull { it.name == "getAverageTickTime" && it.parameterCount == 0 }
                ?.invoke(server)
        }.getOrNull()

        val mspt = (rawMspt as? Number)?.toDouble()
        return mspt?.takeIf { it.isFinite() && it >= 0.0 } ?: (1000.0 / tps.coerceAtLeast(0.01))
    }
}
