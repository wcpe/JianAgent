package jianagent.helper.monitoring

import java.lang.management.ManagementFactory
import java.lang.management.MemoryMXBean
import java.lang.management.MemoryPoolMXBean
import javax.management.MBeanServerConnection
import javax.management.ObjectName
import javax.management.remote.JMXConnectorFactory
import javax.management.remote.JMXServiceURL

data class MemorySnapshot(
    val heap: MemoryUsage,
    val nonHeap: MemoryUsage,
    val pools: Map<String, MemoryPoolInfo>
)

data class MemoryUsage(
    val used: Long,
    val max: Long,
    val committed: Long,
    val usagePercent: Double
)

data class MemoryPoolInfo(
    val type: String,
    val used: Long,
    val max: Long,
    val committed: Long,
    val usagePercent: Double
)

class MemoryMonitor {
    fun collect(jmxUrl: String): MemorySnapshot {
        val url = JMXServiceURL(jmxUrl)
        val connector = JMXConnectorFactory.connect(url)
        val mbs = connector.mBeanServerConnection

        try {
            val memoryMxBean = ManagementFactory.newPlatformMXBeanProxy(
                mbs,
                ManagementFactory.MEMORY_MXBEAN_NAME,
                MemoryMXBean::class.java
            )

            val heapUsage = memoryMxBean.heapMemoryUsage
            val nonHeapUsage = memoryMxBean.nonHeapMemoryUsage

            val heap = MemoryUsage(
                used = heapUsage.used,
                max = heapUsage.max,
                committed = heapUsage.committed,
                usagePercent = if (heapUsage.max > 0) (heapUsage.used.toDouble() / heapUsage.max * 100) else 0.0
            )

            val nonHeap = MemoryUsage(
                used = nonHeapUsage.used,
                max = nonHeapUsage.max,
                committed = nonHeapUsage.committed,
                usagePercent = if (nonHeapUsage.max > 0) (nonHeapUsage.used.toDouble() / nonHeapUsage.max * 100) else 0.0
            )

            // Collect memory pool information
            val pools = mutableMapOf<String, MemoryPoolInfo>()
            val poolNames = mbs.queryNames(ObjectName("java.lang:type=MemoryPool,*"), null)
            
            for (poolName in poolNames) {
                val name = poolName.getKeyProperty("name")
                val type = mbs.getAttribute(poolName, "Type") as String
                val usage = mbs.getAttribute(poolName, "Usage") as javax.management.openmbean.CompositeData
                
                val used = usage.get("used") as Long
                val max = usage.get("max") as Long
                val committed = usage.get("committed") as Long
                
                pools[name] = MemoryPoolInfo(
                    type = type,
                    used = used,
                    max = max,
                    committed = committed,
                    usagePercent = if (max > 0) (used.toDouble() / max * 100) else 0.0
                )
            }

            return MemorySnapshot(heap, nonHeap, pools)
        } finally {
            connector.close()
        }
    }
}
