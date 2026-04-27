package jianagent.helper.dump

import jianagent.helper.attach.AttachManager
import java.io.File
import java.io.PrintWriter
import java.lang.management.ManagementFactory
import java.lang.management.ThreadMXBean
import java.text.SimpleDateFormat
import java.util.Date
import javax.management.remote.JMXConnectorFactory
import javax.management.remote.JMXServiceURL

data class ThreadDumpOptions(
    val outputPath: String,
    val includeLockedMonitors: Boolean = true,
    val includeLockedSynchronizers: Boolean = true,
)

data class ThreadDumpResult(
    val success: Boolean,
    val outputPath: String,
    val fileSizeBytes: Long,
    val threadCount: Int,
    val durationMs: Long,
    val error: String? = null,
)

class ThreadDumpManager {
    fun generateThreadDump(attachManager: AttachManager, options: ThreadDumpOptions): ThreadDumpResult {
        val startTime = System.currentTimeMillis()

        try {
            val jmxUrl = attachManager.getLocalConnectorAddress()
                ?: return ThreadDumpResult(
                    success = false,
                    outputPath = options.outputPath,
                    fileSizeBytes = 0,
                    threadCount = 0,
                    durationMs = 0,
                    error = "Not attached to any process"
                )

            // Validate output path
            val outputFile = File(options.outputPath)
            val parentDir = outputFile.parentFile
            if (parentDir != null && !parentDir.exists()) {
                return ThreadDumpResult(
                    success = false,
                    outputPath = options.outputPath,
                    fileSizeBytes = 0,
                    threadCount = 0,
                    durationMs = System.currentTimeMillis() - startTime,
                    error = "Parent directory does not exist: ${parentDir.absolutePath}"
                )
            }

            if (parentDir != null && !parentDir.canWrite()) {
                return ThreadDumpResult(
                    success = false,
                    outputPath = options.outputPath,
                    fileSizeBytes = 0,
                    threadCount = 0,
                    durationMs = System.currentTimeMillis() - startTime,
                    error = "No write permission for directory: ${parentDir.absolutePath}"
                )
            }

            // Connect via JMX
            val url = JMXServiceURL(jmxUrl)
            val connector = JMXConnectorFactory.connect(url)
            val mbs = connector.mBeanServerConnection

            // Get ThreadMXBean
            val threadMxBean = ManagementFactory.newPlatformMXBeanProxy(
                mbs,
                ManagementFactory.THREAD_MXBEAN_NAME,
                ThreadMXBean::class.java
            )

            // Get all thread info
            val threadInfos = threadMxBean.dumpAllThreads(
                options.includeLockedMonitors,
                options.includeLockedSynchronizers
            )

            // Write to file
            PrintWriter(outputFile).use { writer ->
                writer.println("Full thread dump generated at ${SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(Date())}")
                writer.println()
                writer.println("Total threads: ${threadInfos.size}")
                writer.println("=".repeat(80))
                writer.println()

                for (info in threadInfos) {
                    writer.println("\"${info.threadName}\" #${info.threadId} ${info.threadState}")
                    writer.println("   java.lang.Thread.State: ${info.threadState}")

                    if (info.lockName != null) {
                        writer.println("   Waiting on: ${info.lockName}")
                    }

                    if (info.lockOwnerName != null) {
                        writer.println("   Owned by: \"${info.lockOwnerName}\" #${info.lockOwnerId}")
                    }

                    val stackTrace = info.stackTrace
                    for (element in stackTrace) {
                        writer.println("        at $element")
                    }

                    if (options.includeLockedMonitors && info.lockedMonitors.isNotEmpty()) {
                        writer.println("   Locked monitors:")
                        for (monitor in info.lockedMonitors) {
                            writer.println("        - ${monitor.className}@${monitor.identityHashCode}")
                        }
                    }

                    if (options.includeLockedSynchronizers && info.lockedSynchronizers.isNotEmpty()) {
                        writer.println("   Locked synchronizers:")
                        for (sync in info.lockedSynchronizers) {
                            writer.println("        - ${sync.className}@${sync.identityHashCode}")
                        }
                    }

                    writer.println()
                }
            }

            connector.close()

            val fileSize = if (outputFile.exists()) outputFile.length() else 0L
            val duration = System.currentTimeMillis() - startTime

            return ThreadDumpResult(
                success = true,
                outputPath = options.outputPath,
                fileSizeBytes = fileSize,
                threadCount = threadInfos.size,
                durationMs = duration,
                error = null
            )
        } catch (e: Exception) {
            return ThreadDumpResult(
                success = false,
                outputPath = options.outputPath,
                fileSizeBytes = 0,
                threadCount = 0,
                durationMs = System.currentTimeMillis() - startTime,
                error = e.message ?: "Unknown error"
            )
        }
    }
}
