package jianagent.helper.dump

import jianagent.helper.attach.AttachManager
import java.io.File
import java.lang.management.ManagementFactory
import javax.management.ObjectName
import javax.management.remote.JMXConnectorFactory
import javax.management.remote.JMXServiceURL

data class HeapDumpOptions(
    val outputPath: String,
    val liveObjectsOnly: Boolean = true,
)

data class HeapDumpResult(
    val success: Boolean,
    val outputPath: String,
    val fileSizeBytes: Long,
    val durationMs: Long,
    val error: String? = null,
)

data class DiskSpaceInfo(
    val availableBytes: Long,
    val totalBytes: Long,
    val usableBytes: Long,
)

data class HeapEstimate(
    val estimatedBytes: Long,
    val heapUsedBytes: Long,
    val heapMaxBytes: Long,
)

class HeapDumpManager {
    fun generateHeapDump(attachManager: AttachManager, options: HeapDumpOptions): HeapDumpResult {
        val startTime = System.currentTimeMillis()

        try {
            val jmxUrl = attachManager.getLocalConnectorAddress()
                ?: return HeapDumpResult(
                    success = false,
                    outputPath = options.outputPath,
                    fileSizeBytes = 0,
                    durationMs = 0,
                    error = "Not attached to any process"
                )

            // Validate output path
            val outputFile = File(options.outputPath)
            val parentDir = outputFile.parentFile
            if (parentDir != null && !parentDir.exists()) {
                return HeapDumpResult(
                    success = false,
                    outputPath = options.outputPath,
                    fileSizeBytes = 0,
                    durationMs = System.currentTimeMillis() - startTime,
                    error = "Parent directory does not exist: ${parentDir.absolutePath}"
                )
            }

            if (parentDir != null && !parentDir.canWrite()) {
                return HeapDumpResult(
                    success = false,
                    outputPath = options.outputPath,
                    fileSizeBytes = 0,
                    durationMs = System.currentTimeMillis() - startTime,
                    error = "No write permission for directory: ${parentDir.absolutePath}"
                )
            }

            // Connect via JMX
            val url = JMXServiceURL(jmxUrl)
            val connector = JMXConnectorFactory.connect(url)
            val mbs = connector.mBeanServerConnection

            // Get HotSpotDiagnosticMXBean
            val hotspotMBean = ObjectName("com.sun.management:type=HotSpotDiagnostic")

            // Invoke dumpHeap
            mbs.invoke(
                hotspotMBean,
                "dumpHeap",
                arrayOf(options.outputPath, options.liveObjectsOnly),
                arrayOf("java.lang.String", "boolean")
            )

            connector.close()

            val fileSize = if (outputFile.exists()) outputFile.length() else 0L
            val duration = System.currentTimeMillis() - startTime

            return HeapDumpResult(
                success = true,
                outputPath = options.outputPath,
                fileSizeBytes = fileSize,
                durationMs = duration,
                error = null
            )
        } catch (e: Exception) {
            return HeapDumpResult(
                success = false,
                outputPath = options.outputPath,
                fileSizeBytes = 0,
                durationMs = System.currentTimeMillis() - startTime,
                error = e.message ?: "Unknown error"
            )
        }
    }

    fun checkDiskSpace(path: String): DiskSpaceInfo {
        return try {
            val file = File(path)
            val parentDir = file.parentFile ?: File("/")

            DiskSpaceInfo(
                availableBytes = parentDir.freeSpace,
                totalBytes = parentDir.totalSpace,
                usableBytes = parentDir.usableSpace
            )
        } catch (e: Exception) {
            DiskSpaceInfo(0, 0, 0)
        }
    }

    fun estimateHeapSize(attachManager: AttachManager): HeapEstimate {
        return try {
            val jmxUrl = attachManager.getLocalConnectorAddress()
                ?: return HeapEstimate(0, 0, 0)

            val url = JMXServiceURL(jmxUrl)
            val connector = JMXConnectorFactory.connect(url)
            val mbs = connector.mBeanServerConnection

            val memoryMxBean = ManagementFactory.newPlatformMXBeanProxy(
                mbs,
                ManagementFactory.MEMORY_MXBEAN_NAME,
                java.lang.management.MemoryMXBean::class.java
            )

            val heapUsage = memoryMxBean.heapMemoryUsage
            connector.close()

            // Estimate dump size as 1.3x heap used (accounting for object headers, etc.)
            val estimatedSize = (heapUsage.used * 1.3).toLong()

            HeapEstimate(
                estimatedBytes = estimatedSize,
                heapUsedBytes = heapUsage.used,
                heapMaxBytes = heapUsage.max,
            )
        } catch (e: Exception) {
            HeapEstimate(0, 0, 0)
        }
    }
}
