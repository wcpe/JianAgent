package jianagent.helper.sampling

import jianagent.helper.attach.AttachManager
import java.lang.management.ManagementFactory
import java.lang.management.ThreadMXBean
import javax.management.remote.JMXConnectorFactory
import javax.management.remote.JMXServiceURL

data class ThreadInfoData(
    val id: Long,
    val name: String,
    val state: String,
    val stackTrace: List<String>,
)

data class ThreadSampleResult(
    val threadCount: Int,
    val threads: List<ThreadInfoData>,
    val sampledAt: Long = System.currentTimeMillis(),
)

class ThreadSampler {
    fun sample(attachManager: AttachManager): ThreadSampleResult {
        val jmxUrl = attachManager.getLocalConnectorAddress()
        if (jmxUrl != null) {
            return sampleViaJmx(jmxUrl)
        }
        return ThreadSampleResult(threadCount = 0, threads = emptyList())
    }

    private fun sampleViaJmx(jmxUrl: String): ThreadSampleResult {
        return try {
            val url = JMXServiceURL(jmxUrl)
            val connector = JMXConnectorFactory.connect(url)
            val mbs = connector.mBeanServerConnection
            val threadMxBean = ManagementFactory.newPlatformMXBeanProxy(
                mbs,
                ManagementFactory.THREAD_MXBEAN_NAME,
                ThreadMXBean::class.java,
            )
            val threadIds = threadMxBean.allThreadIds
            val infos = threadMxBean.getThreadInfo(threadIds, 10)
            val threads = infos.filterNotNull().map { info ->
                ThreadInfoData(
                    id = info.threadId,
                    name = info.threadName,
                    state = info.threadState.name,
                    stackTrace = info.stackTrace.map { it.toString() },
                )
            }
            connector.close()
            ThreadSampleResult(threadCount = threads.size, threads = threads)
        } catch (e: Exception) {
            ThreadSampleResult(threadCount = 0, threads = emptyList())
        }
    }
}
