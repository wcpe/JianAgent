package jianagent.helper.lifecycle

import jianagent.helper.attach.AttachManager
import java.lang.management.ManagementFactory
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import javax.management.ObjectName
import javax.management.remote.JMXConnectorFactory
import javax.management.remote.JMXServiceURL

data class ShutdownResult(
    val success: Boolean,
    val message: String,
    val graceful: Boolean,
    val durationMs: Long,
    val timedOut: Boolean = false,
)

class ShutdownManager {
    fun shutdown(
        attachManager: AttachManager,
        graceful: Boolean = true,
        timeoutSeconds: Int = 30
    ): ShutdownResult {
        val startTime = System.currentTimeMillis()

        try {
            val targetPid = attachManager.attachedPid
                ?: return ShutdownResult(
                    success = false,
                    message = "Not attached to any process",
                    graceful = graceful,
                    durationMs = 0,
                    timedOut = false
                )

            // Use OS-level process termination instead of JMX
            // This is more reliable and works across all JVM implementations
            val pidLong = targetPid.toLongOrNull()
                ?: return ShutdownResult(
                    success = false,
                    message = "Invalid PID: $targetPid",
                    graceful = graceful,
                    durationMs = 0,
                    timedOut = false
                )

            if (graceful) {
                // Try graceful shutdown with SIGTERM
                val shutdownFuture = CompletableFuture.supplyAsync {
                    try {
                        val process = ProcessHandle.of(pidLong).orElse(null)
                            ?: throw IllegalStateException("Process $pidLong not found")
                        
                        // Send SIGTERM for graceful shutdown
                        val destroyed = process.destroy()
                        if (!destroyed) {
                            throw IllegalStateException("Failed to send termination signal")
                        }
                        
                        // Wait for process to exit
                        process.onExit().get(timeoutSeconds.toLong(), TimeUnit.SECONDS)
                        true
                    } catch (e: java.util.concurrent.TimeoutException) {
                        // Timeout - will be handled by outer catch
                        throw e
                    } catch (e: Exception) {
                        throw e
                    }
                }

                try {
                    shutdownFuture.get(timeoutSeconds.toLong() + 1, TimeUnit.SECONDS)
                    
                    val duration = System.currentTimeMillis() - startTime
                    return ShutdownResult(
                        success = true,
                        message = "Graceful shutdown completed successfully",
                        graceful = true,
                        durationMs = duration,
                        timedOut = false
                    )
                } catch (e: java.util.concurrent.TimeoutException) {
                    // Timeout occurred, fallback to force shutdown with SIGKILL
                    try {
                        val process = ProcessHandle.of(pidLong).orElse(null)
                        if (process != null && process.isAlive) {
                            process.destroyForcibly()
                            // Wait a bit for forced termination
                            process.onExit().get(5, TimeUnit.SECONDS)
                        }
                    } catch (killException: Exception) {
                        // Process might already be dead
                    }
                    
                    val duration = System.currentTimeMillis() - startTime
                    return ShutdownResult(
                        success = true,
                        message = "Graceful shutdown timed out after ${timeoutSeconds}s, forced shutdown executed",
                        graceful = false,
                        durationMs = duration,
                        timedOut = true
                    )
                }
            } else {
                // Force shutdown immediately with SIGKILL
                try {
                    val process = ProcessHandle.of(pidLong).orElse(null)
                        ?: throw IllegalStateException("Process $pidLong not found")
                    
                    process.destroyForcibly()
                    // Wait for confirmation
                    process.onExit().get(5, TimeUnit.SECONDS)
                } catch (e: Exception) {
                    // Process might already be dead, which is fine
                    if (ProcessHandle.of(pidLong).map { it.isAlive }.orElse(false)) {
                        throw e
                    }
                }
                
                val duration = System.currentTimeMillis() - startTime
                return ShutdownResult(
                    success = true,
                    message = "Force shutdown executed successfully",
                    graceful = false,
                    durationMs = duration,
                    timedOut = false
                )
            }
        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - startTime
            return ShutdownResult(
                success = false,
                message = "Shutdown failed: ${e.message ?: "Unknown error"}",
                graceful = graceful,
                durationMs = duration,
                timedOut = false
            )
        }
    }
}
