package jianagent.helper.sampling

import jianagent.helper.attach.AttachManager
import java.lang.management.ManagementFactory
import java.lang.management.ThreadMXBean
import javax.management.remote.JMXConnectorFactory
import javax.management.remote.JMXServiceURL

data class ExceptionEvent(
    val exceptionClass: String,
    val message: String?,
    val stackTrace: List<String>,
    val timestamp: Long,
    val threadName: String,
)

class ExceptionMonitor {
    private val events = mutableListOf<ExceptionEvent>()
    @Volatile
    private var monitoring = false
    private var filterPrefix: String? = null
    private var monitorThread: Thread? = null

    val isMonitoring: Boolean get() = monitoring
    val eventCount: Int get() = events.size

    fun startMonitoring(attachManager: AttachManager, exceptionFilter: String? = null) {
        if (monitoring) return
        val jmxUrl = attachManager.getLocalConnectorAddress()
            ?: throw IllegalStateException("JMX connector not available")

        monitoring = true
        filterPrefix = exceptionFilter
        events.clear()

        monitorThread = Thread({
            try {
                val url = JMXServiceURL(jmxUrl)
                JMXConnectorFactory.connect(url).use { connector ->
                    val mbs = connector.mBeanServerConnection
                    val threadMxBean = ManagementFactory.newPlatformMXBeanProxy(
                        mbs,
                        ManagementFactory.THREAD_MXBEAN_NAME,
                        ThreadMXBean::class.java,
                    )

                    while (monitoring) {
                        scanForExceptions(threadMxBean)
                        Thread.sleep(100)
                    }
                }
            } catch (_: InterruptedException) {
                // normal shutdown
            } catch (e: Exception) {
                // monitoring interrupted
            } finally {
                monitoring = false
            }
        }, "exception-monitor").apply {
            isDaemon = true
            start()
        }
    }

    fun stopMonitoring(): List<ExceptionEvent> {
        monitoring = false
        monitorThread?.interrupt()
        monitorThread?.join(2000)
        monitorThread = null
        return events.toList().also { events.clear() }
    }

    fun getEvents(): List<ExceptionEvent> = synchronized(events) { events.toList() }

    private fun scanForExceptions(threadMxBean: ThreadMXBean) {
        val threadIds = threadMxBean.allThreadIds
        val infos = threadMxBean.getThreadInfo(threadIds, 64)
        for (info in infos) {
            if (info == null) continue
            val stack = info.stackTrace
            // Detect exception-related stack frames
            for (frame in stack) {
                if (isExceptionFrame(frame)) {
                    val exClass = extractExceptionClass(frame, stack)
                    if (matchesFilter(exClass)) {
                        synchronized(events) {
                            events.add(
                                ExceptionEvent(
                                    exceptionClass = exClass,
                                    message = null,
                                    stackTrace = stack.map { it.toString() },
                                    timestamp = System.currentTimeMillis(),
                                    threadName = info.threadName,
                                )
                            )
                        }
                    }
                    break
                }
            }
        }
    }

    private fun isExceptionFrame(frame: StackTraceElement): Boolean {
        val method = frame.methodName
        return method == "<init>" && (
            frame.className.endsWith("Exception") ||
                frame.className.endsWith("Error") ||
                frame.className.endsWith("Throwable")
            )
    }

    private fun extractExceptionClass(
        frame: StackTraceElement,
        stack: Array<StackTraceElement>,
    ): String {
        return frame.className
    }

    private fun matchesFilter(exceptionClass: String): Boolean {
        val prefix = filterPrefix ?: return true
        return exceptionClass.startsWith(prefix)
    }
}
