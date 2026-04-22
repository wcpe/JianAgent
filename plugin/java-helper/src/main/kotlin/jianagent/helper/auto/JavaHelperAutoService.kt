package jianagent.helper.auto

import jianagent.helper.attach.AttachManager
import jianagent.helper.sampling.MethodProfiler
import jianagent.helper.sampling.ExceptionMonitor

/**
 * Coordinates automatic profiling and monitoring sessions.
 * Called by the CommandDispatcher upon receiving auto-* commands
 * from the Node.js server side.
 */
class JavaHelperAutoService(
    private val attachManager: AttachManager,
    private val methodProfiler: MethodProfiler,
    private val exceptionMonitor: ExceptionMonitor,
) {
    data class AutoSessionConfig(
        val profilingEnabled: Boolean = false,
        val profilingDurationSeconds: Int = 10,
        val exceptionMonitorEnabled: Boolean = false,
        val exceptionFilter: String? = null,
    )

    private var config = AutoSessionConfig()

    fun getConfig(): AutoSessionConfig = config

    fun updateConfig(newConfig: AutoSessionConfig) {
        config = newConfig
    }

    /**
     * Start all enabled auto-instruments.
     * Called when the server-side auto-attach event fires.
     */
    fun startAutoSession(): Map<String, Any?> {
        val results = mutableMapOf<String, Any?>()

        if (config.profilingEnabled) {
            try {
                val profilingResult = methodProfiler.startProfiling(
                    attachManager,
                    config.profilingDurationSeconds,
                )
                results["profiling"] = mapOf(
                    "success" to true,
                    "hotspots" to profilingResult.hotspots.size,
                    "totalSamples" to profilingResult.totalSamples,
                )
            } catch (e: Exception) {
                results["profiling"] = mapOf("success" to false, "error" to e.message)
            }
        }

        if (config.exceptionMonitorEnabled) {
            try {
                exceptionMonitor.startMonitoring(attachManager, config.exceptionFilter)
                results["exceptionMonitor"] = mapOf("success" to true)
            } catch (e: Exception) {
                results["exceptionMonitor"] = mapOf("success" to false, "error" to e.message)
            }
        }

        return results
    }

    /**
     * Stop all running auto-instruments and collect results.
     */
    fun stopAutoSession(): Map<String, Any?> {
        val results = mutableMapOf<String, Any?>()

        if (methodProfiler.isRunning) {
            methodProfiler.stopProfiling()
            results["profiling"] = mapOf("stopped" to true)
        }

        if (exceptionMonitor.isMonitoring) {
            val events = exceptionMonitor.stopMonitoring()
            results["exceptionMonitor"] = mapOf(
                "stopped" to true,
                "eventsCollected" to events.size,
                "events" to events,
            )
        }

        return results
    }
}
