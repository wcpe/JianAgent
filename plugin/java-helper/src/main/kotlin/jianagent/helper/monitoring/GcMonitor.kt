package jianagent.helper.monitoring

import java.lang.management.GarbageCollectorMXBean
import java.lang.management.ManagementFactory
import javax.management.MBeanServerConnection
import javax.management.ObjectName
import javax.management.remote.JMXConnectorFactory
import javax.management.remote.JMXServiceURL

data class GcSnapshot(
    val collectors: List<GcCollectorInfo>,
    val totalCollections: Long,
    val totalCollectionTimeMs: Long
)

data class GcCollectorInfo(
    val name: String,
    val collectionCount: Long,
    val collectionTimeMs: Long,
    val memoryPoolNames: List<String>
)

class GcMonitor {
    private var lastGcCounts: Map<String, Long>? = null
    private var lastGcTimes: Map<String, Long>? = null

    fun collect(jmxUrl: String): GcSnapshot {
        val url = JMXServiceURL(jmxUrl)
        val connector = JMXConnectorFactory.connect(url)
        val mbs = connector.mBeanServerConnection

        try {
            val gcBeans = mutableListOf<GcCollectorInfo>()
            var totalCollections = 0L
            var totalCollectionTimeMs = 0L

            val gcNames = mbs.queryNames(ObjectName("java.lang:type=GarbageCollector,*"), null)

            for (gcName in gcNames) {
                val name = gcName.getKeyProperty("name")
                val collectionCount = mbs.getAttribute(gcName, "CollectionCount") as Long
                val collectionTime = mbs.getAttribute(gcName, "CollectionTime") as Long
                val memoryPoolNames = (mbs.getAttribute(gcName, "MemoryPoolNames") as Array<*>)
                    .map { it.toString() }

                gcBeans.add(
                    GcCollectorInfo(
                        name = name,
                        collectionCount = collectionCount,
                        collectionTimeMs = collectionTime,
                        memoryPoolNames = memoryPoolNames
                    )
                )

                totalCollections += collectionCount
                totalCollectionTimeMs += collectionTime
            }

            // Store current values for delta calculation next time
            lastGcCounts = gcBeans.associate { it.name to it.collectionCount }
            lastGcTimes = gcBeans.associate { it.name to it.collectionTimeMs }

            return GcSnapshot(
                collectors = gcBeans,
                totalCollections = totalCollections,
                totalCollectionTimeMs = totalCollectionTimeMs
            )
        } finally {
            connector.close()
        }
    }

    fun getGcDelta(current: GcSnapshot): GcDelta? {
        if (lastGcCounts == null || lastGcTimes == null) {
            return null
        }

        val collectorDeltas = current.collectors.mapNotNull { collector ->
            val lastCount = lastGcCounts?.get(collector.name)
            val lastTime = lastGcTimes?.get(collector.name)

            if (lastCount != null && lastTime != null) {
                GcCollectorDelta(
                    name = collector.name,
                    collectionCountDelta = collector.collectionCount - lastCount,
                    collectionTimeMsDelta = collector.collectionTimeMs - lastTime
                )
            } else {
                null
            }
        }

        return GcDelta(collectorDeltas)
    }
}

data class GcDelta(
    val collectors: List<GcCollectorDelta>
)

data class GcCollectorDelta(
    val name: String,
    val collectionCountDelta: Long,
    val collectionTimeMsDelta: Long
)
