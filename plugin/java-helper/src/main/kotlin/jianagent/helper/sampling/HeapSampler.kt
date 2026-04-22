package jianagent.helper.sampling

import jianagent.helper.attach.AttachManager
import java.lang.management.ManagementFactory
import java.lang.management.MemoryMXBean
import javax.management.remote.JMXConnectorFactory
import javax.management.remote.JMXServiceURL

data class HeapUsageInfo(
    val used: Long,
    val max: Long,
    val committed: Long,
    val usagePercent: Double,
)

data class HeapSampleResult(
    val heapUsage: HeapUsageInfo,
    val nonHeapUsage: HeapUsageInfo,
    val sampledAt: Long = System.currentTimeMillis(),
)

class HeapSampler {
    fun sample(attachManager: AttachManager): HeapSampleResult {
        val jmxUrl = attachManager.getLocalConnectorAddress()
        if (jmxUrl != null) {
            return sampleViaJmx(jmxUrl)
        }
        return HeapSampleResult(
            heapUsage = HeapUsageInfo(0, 0, 0, 0.0),
            nonHeapUsage = HeapUsageInfo(0, 0, 0, 0.0),
        )
    }

    private fun sampleViaJmx(jmxUrl: String): HeapSampleResult {
        return try {
            val url = JMXServiceURL(jmxUrl)
            val connector = JMXConnectorFactory.connect(url)
            val mbs = connector.mBeanServerConnection
            val memoryMxBean = ManagementFactory.newPlatformMXBeanProxy(
                mbs,
                ManagementFactory.MEMORY_MXBEAN_NAME,
                MemoryMXBean::class.java,
            )
            val heap = memoryMxBean.heapMemoryUsage
            val nonHeap = memoryMxBean.nonHeapMemoryUsage
            connector.close()
            HeapSampleResult(
                heapUsage = HeapUsageInfo(
                    used = heap.used,
                    max = heap.max,
                    committed = heap.committed,
                    usagePercent = if (heap.max > 0) heap.used.toDouble() / heap.max * 100 else 0.0,
                ),
                nonHeapUsage = HeapUsageInfo(
                    used = nonHeap.used,
                    max = nonHeap.max,
                    committed = nonHeap.committed,
                    usagePercent = if (nonHeap.max > 0) nonHeap.used.toDouble() / nonHeap.max * 100 else 0.0,
                ),
            )
        } catch (e: Exception) {
            HeapSampleResult(
                heapUsage = HeapUsageInfo(0, 0, 0, 0.0),
                nonHeapUsage = HeapUsageInfo(0, 0, 0, 0.0),
            )
        }
    }
}
