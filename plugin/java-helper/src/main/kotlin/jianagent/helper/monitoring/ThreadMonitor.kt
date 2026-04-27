package jianagent.helper.monitoring

import java.lang.management.ManagementFactory
import java.lang.management.ThreadMXBean
import javax.management.remote.JMXConnectorFactory
import javax.management.remote.JMXServiceURL

data class ThreadSnapshot(
    val totalThreads: Int,
    val daemonThreads: Int,
    val peakThreads: Int,
    val stateDistribution: Map<String, Int>,
    val deadlockedThreads: List<Long>,
    val topCpuThreads: List<ThreadCpuInfo>?
)

data class ThreadCpuInfo(
    val threadId: Long,
    val threadName: String,
    val cpuTimeNs: Long,
    val userTimeNs: Long
)

class ThreadMonitor {
    private var lastThreadCpuTimes: Map<Long, Long>? = null
    private var lastCollectionTime: Long = 0

    fun collect(jmxUrl: String): ThreadSnapshot {
        val url = JMXServiceURL(jmxUrl)
        val connector = JMXConnectorFactory.connect(url)
        val mbs = connector.mBeanServerConnection

        try {
            val threadMxBean = ManagementFactory.newPlatformMXBeanProxy(
                mbs,
                ManagementFactory.THREAD_MXBEAN_NAME,
                ThreadMXBean::class.java
            )

            val totalThreads = threadMxBean.threadCount
            val daemonThreads = threadMxBean.daemonThreadCount
            val peakThreads = threadMxBean.peakThreadCount

            // Get thread state distribution
            val allThreadIds = threadMxBean.allThreadIds
            val threadInfos = threadMxBean.getThreadInfo(allThreadIds)
            val stateDistribution = mutableMapOf<String, Int>()

            for (info in threadInfos) {
                if (info != null) {
                    val state = info.threadState.name
                    stateDistribution[state] = stateDistribution.getOrDefault(state, 0) + 1
                }
            }

            // Detect deadlocks
            val deadlockedThreads = threadMxBean.findDeadlockedThreads()?.toList() ?: emptyList()

            // Collect CPU time for threads (if supported)
            val topCpuThreads = if (threadMxBean.isThreadCpuTimeSupported) {
                collectTopCpuThreads(threadMxBean, allThreadIds)
            } else {
                null
            }

            return ThreadSnapshot(
                totalThreads = totalThreads,
                daemonThreads = daemonThreads,
                peakThreads = peakThreads,
                stateDistribution = stateDistribution,
                deadlockedThreads = deadlockedThreads,
                topCpuThreads = topCpuThreads
            )
        } finally {
            connector.close()
        }
    }

    private fun collectTopCpuThreads(threadMxBean: ThreadMXBean, allThreadIds: LongArray): List<ThreadCpuInfo> {
        val currentTime = System.currentTimeMillis()
        val currentCpuTimes = mutableMapOf<Long, Long>()
        val threadCpuInfos = mutableListOf<ThreadCpuInfo>()

        for (threadId in allThreadIds) {
            try {
                val cpuTime = threadMxBean.getThreadCpuTime(threadId)
                val userTime = threadMxBean.getThreadUserTime(threadId)
                
                if (cpuTime >= 0) {
                    currentCpuTimes[threadId] = cpuTime
                    
                    val threadInfo = threadMxBean.getThreadInfo(threadId)
                    if (threadInfo != null) {
                        threadCpuInfos.add(
                            ThreadCpuInfo(
                                threadId = threadId,
                                threadName = threadInfo.threadName,
                                cpuTimeNs = cpuTime,
                                userTimeNs = userTime
                            )
                        )
                    }
                }
            } catch (e: Exception) {
                // Thread may have terminated
            }
        }

        // Calculate CPU delta if we have previous data
        val cpuDeltas = if (lastThreadCpuTimes != null && lastCollectionTime > 0) {
            val timeDelta = currentTime - lastCollectionTime
            threadCpuInfos.mapNotNull { info ->
                val lastCpuTime = lastThreadCpuTimes?.get(info.threadId)
                if (lastCpuTime != null) {
                    val cpuDelta = info.cpuTimeNs - lastCpuTime
                    info to cpuDelta
                } else {
                    null
                }
            }.sortedByDescending { it.second }.take(10).map { it.first }
        } else {
            // First collection, just return top by absolute CPU time
            threadCpuInfos.sortedByDescending { it.cpuTimeNs }.take(10)
        }

        lastThreadCpuTimes = currentCpuTimes
        lastCollectionTime = currentTime

        return cpuDeltas
    }
}
