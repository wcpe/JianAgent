package top.wcpe.mc.plugin.jianagent.runtime

import taboolib.platform.util.bukkitPlugin

object BukkitSnapshotScheduler : SnapshotScheduler {
    override fun schedule(intervalTicks: Long, action: () -> Unit): SnapshotTask {
        val normalizedTicks = intervalTicks.coerceAtLeast(1L)
        val task = bukkitPlugin.server.scheduler.runTaskTimer(
            bukkitPlugin,
            Runnable(action),
            normalizedTicks,
            normalizedTicks,
        )
        return SnapshotTask { task.cancel() }
    }

    fun execute(action: () -> Unit) {
        val server = bukkitPlugin.server
        if (server.isPrimaryThread) {
            action()
            return
        }
        server.scheduler.runTask(bukkitPlugin, Runnable(action))
    }
}