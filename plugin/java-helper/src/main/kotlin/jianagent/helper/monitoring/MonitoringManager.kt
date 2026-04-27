package jianagent.helper.monitoring

import com.google.gson.Gson
import jianagent.helper.attach.AttachManager
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

data class MonitoringSnapshot(
    val type: String = "monitoring-snapshot",
    val timestamp: Long,
    val memory: MemorySnapshot,
    val threads: ThreadSnapshot,
    val gc: GcSnapshot
)

data class MonitoringStartResult(
    val success: Boolean,
    val intervalSeconds: Int,
    val error: String? = null
)

data class MonitoringStopResult(
    val success: Boolean,
    val error: String? = null
)

class MonitoringManager {
    private val memoryMonitor = MemoryMonitor()
    private val threadMonitor = ThreadMonitor()
    private val gcMonitor = GcMonitor()
    private val gson = Gson()

    private var scheduler: ScheduledExecutorService? = null
    private var monitoringTask: ScheduledFuture<*>? = null
    private val isRunning = AtomicBoolean(false)

    fun startMonitoring(attachManager: AttachManager, intervalSeconds: Int): MonitoringStartResult {
        if (isRunning.get()) {
            return MonitoringStartResult(
                success = false,
                intervalSeconds = intervalSeconds,
                error = "Monitoring is already running"
            )
        }

        val jmxUrl = attachManager.getLocalConnectorAddress()
            ?: return MonitoringStartResult(
                success = false,
                intervalSeconds = intervalSeconds,
                error = "Not attached to any process"
            )

        try {
            // Create scheduler
            scheduler = Executors.newSingleThreadScheduledExecutor { r ->
                Thread(r, "monitoring-thread").apply {
                    isDaemon = true
                }
            }

            // Schedule monitoring task
            monitoringTask = scheduler?.scheduleAtFixedRate(
                {
                    try {
                        collectAndOutput(jmxUrl)
                    } catch (e: Exception) {
                        System.err.println("Error during monitoring: ${e.message}")
                        e.printStackTrace()
                    }
                },
                0,
                intervalSeconds.toLong(),
                TimeUnit.SECONDS
            )

            isRunning.set(true)

            return MonitoringStartResult(
                success = true,
                intervalSeconds = intervalSeconds,
                error = null
            )
        } catch (e: Exception) {
            cleanup()
            return MonitoringStartResult(
                success = false,
                intervalSeconds = intervalSeconds,
                error = "Failed to start monitoring: ${e.message}"
            )
        }
    }

    fun stopMonitoring(): MonitoringStopResult {
        if (!isRunning.get()) {
            return MonitoringStopResult(
                success = false,
                error = "Monitoring is not running"
            )
        }

        try {
            cleanup()
            isRunning.set(false)

            return MonitoringStopResult(
                success = true,
                error = null
            )
        } catch (e: Exception) {
            return MonitoringStopResult(
                success = false,
                error = "Failed to stop monitoring: ${e.message}"
            )
        }
    }

    fun isMonitoring(): Boolean = isRunning.get()

    private fun collectAndOutput(jmxUrl: String) {
        val timestamp = System.currentTimeMillis()

        val memory = memoryMonitor.collect(jmxUrl)
        val threads = threadMonitor.collect(jmxUrl)
        val gc = gcMonitor.collect(jmxUrl)

        val snapshot = MonitoringSnapshot(
            timestamp = timestamp,
            memory = memory,
            threads = threads,
            gc = gc
        )

        // Output as JSON to stdout
        val json = gson.toJson(snapshot)
        println(json)
        System.out.flush()
    }

    private fun cleanup() {
        monitoringTask?.cancel(false)
        monitoringTask = null

        scheduler?.shutdown()
        try {
            if (scheduler?.awaitTermination(5, TimeUnit.SECONDS) == false) {
                scheduler?.shutdownNow()
            }
        } catch (e: InterruptedException) {
            scheduler?.shutdownNow()
            Thread.currentThread().interrupt()
        }
        scheduler = null
    }
}
