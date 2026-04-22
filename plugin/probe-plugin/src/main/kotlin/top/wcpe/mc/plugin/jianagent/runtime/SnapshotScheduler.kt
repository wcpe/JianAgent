package top.wcpe.mc.plugin.jianagent.runtime

fun interface SnapshotTask {
    fun cancel()
}

fun interface SnapshotScheduler {
    fun schedule(intervalTicks: Long, action: () -> Unit): SnapshotTask
}