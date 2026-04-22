package jianagent.helper.sampling

import jianagent.helper.attach.AttachManager
import java.lang.management.ManagementFactory
import java.lang.management.ThreadMXBean
import javax.management.remote.JMXConnectorFactory
import javax.management.remote.JMXServiceURL

data class MethodHotspot(
    val className: String,
    val methodName: String,
    val samples: Int,
    val percentage: Double,
    val callerChain: List<String>,
)

data class ProfilingResult(
    val pid: String,
    val durationMs: Long,
    val totalSamples: Int,
    val hotspots: List<MethodHotspot>,
)

class MethodProfiler {
    private val stackSamples = mutableMapOf<String, MutableList<List<String>>>()
    @Volatile
    private var running = false

    val isRunning: Boolean get() = running

    fun startProfiling(attachManager: AttachManager, durationSeconds: Int = 10): ProfilingResult {
        val pid = attachManager.attachedPid
            ?: throw IllegalStateException("Not attached to any JVM")
        val jmxUrl = attachManager.getLocalConnectorAddress()
            ?: throw IllegalStateException("JMX connector not available")

        stackSamples.clear()
        running = true
        val startTime = System.currentTimeMillis()
        val endTime = startTime + durationSeconds * 1000L
        val intervalMs = 10L

        try {
            val url = JMXServiceURL(jmxUrl)
            JMXConnectorFactory.connect(url).use { connector ->
                val mbs = connector.mBeanServerConnection
                val threadMxBean = ManagementFactory.newPlatformMXBeanProxy(
                    mbs,
                    ManagementFactory.THREAD_MXBEAN_NAME,
                    ThreadMXBean::class.java,
                )

                while (running && System.currentTimeMillis() < endTime) {
                    sampleOnce(threadMxBean)
                    Thread.sleep(intervalMs)
                }
            }
        } catch (e: Exception) {
            // Sampling may be interrupted; still return partial results
        } finally {
            running = false
        }

        return aggregateResults(pid, System.currentTimeMillis() - startTime)
    }

    fun stopProfiling() {
        running = false
    }

    private fun sampleOnce(threadMxBean: ThreadMXBean) {
        val threadIds = threadMxBean.allThreadIds
        val infos = threadMxBean.getThreadInfo(threadIds, 32)
        for (info in infos) {
            if (info == null) continue
            val stack = info.stackTrace
            if (stack.isEmpty()) continue

            val top = stack[0]
            val key = "${top.className}.${top.methodName}"
            val chain = stack.take(5).map { "${it.className}.${it.methodName}" }
            stackSamples.getOrPut(key) { mutableListOf() }.add(chain)
        }
    }

    private fun aggregateResults(pid: String, durationMs: Long): ProfilingResult {
        val totalSamples = stackSamples.values.sumOf { it.size }
        if (totalSamples == 0) {
            return ProfilingResult(pid, durationMs, 0, emptyList())
        }

        val hotspots = stackSamples.entries
            .sortedByDescending { it.value.size }
            .take(20)
            .map { (key, chains) ->
                val parts = key.split(".", limit = 2)
                val className = if (parts.size > 1) {
                    key.substringBeforeLast(".")
                } else {
                    key
                }
                val methodName = key.substringAfterLast(".")
                val topCallers = chains
                    .flatMap { it.drop(1).take(3) }
                    .groupingBy { it }
                    .eachCount()
                    .entries
                    .sortedByDescending { it.value }
                    .take(3)
                    .map { it.key }

                MethodHotspot(
                    className = className,
                    methodName = methodName,
                    samples = chains.size,
                    percentage = (chains.size.toDouble() / totalSamples) * 100.0,
                    callerChain = topCallers,
                )
            }

        return ProfilingResult(
            pid = pid,
            durationMs = durationMs,
            totalSamples = totalSamples,
            hotspots = hotspots,
        )
    }
}
