package jianagent.helper

import com.google.gson.Gson
import com.google.gson.JsonObject
import jianagent.helper.resolve.JvmResolver
import jianagent.helper.attach.AttachManager
import jianagent.helper.sampling.ThreadSampler
import jianagent.helper.sampling.HeapSampler
import jianagent.helper.scan.JarScanner
import jianagent.helper.dump.HeapDumpManager
import jianagent.helper.dump.HeapDumpOptions
import jianagent.helper.dump.ThreadDumpManager
import jianagent.helper.dump.ThreadDumpOptions
import jianagent.helper.jfr.JfrManager
import jianagent.helper.jfr.JfrStartOptions
import jianagent.helper.info.JvmInfoManager
import jianagent.helper.sampling.CpuSamplingManager
import jianagent.helper.lifecycle.ShutdownManager
import jianagent.helper.monitoring.MonitoringManager

class CommandDispatcher(private val gson: Gson) {
    private val resolver = JvmResolver()
    private val attachManager = AttachManager()
    private val threadSampler = ThreadSampler()
    private val heapSampler = HeapSampler()
    private val jarScanner = JarScanner()
    private val heapDumpManager = HeapDumpManager()
    private val threadDumpManager = ThreadDumpManager()
    private val jfrManager = JfrManager()
    private val jvmInfoManager = JvmInfoManager()
    private val cpuSamplingManager = CpuSamplingManager()
    private val shutdownManager = ShutdownManager()
    private val monitoringManager = MonitoringManager()

    fun dispatch(line: String): Map<String, Any?> {
        return try {
            val json = gson.fromJson(line, JsonObject::class.java)
            val type = json.get("type")?.asString
                ?: return errorResponse("missing type")

            when (type) {
                "resolve" -> handleResolve()
                "attach" -> handleAttach(json)
                "sample-threads" -> handleSampleThreads()
                "sample-heap" -> handleSampleHeap()
                "scan-jar" -> handleScanJar(json)
                "thread-dump" -> handleThreadDump(json)
                "jfr-start" -> handleJfrStart(json)
                "jfr-stop" -> handleJfrStop(json)
                "jfr-status" -> handleJfrStatus(json)
                "jvm-flags" -> handleJvmFlags()
                "class-loading" -> handleClassLoading()
                "cpu-sampling" -> handleCpuSampling(json)
                "gc-info" -> handleGcInfo()
                "detach" -> handleDetach()
                "status" -> handleStatus()
                "heap-dump" -> handleHeapDump(json)
                "check-disk-space" -> handleCheckDiskSpace(json)
                "estimate-heap-size" -> handleEstimateHeapSize()
                "shutdown" -> handleShutdown(json)
                "start-monitoring" -> handleStartMonitoring(json)
                "stop-monitoring" -> handleStopMonitoring()
                "monitoring-status" -> handleMonitoringStatus()
                else -> errorResponse("unknown command: $type")
            }
        } catch (e: Exception) {
            errorResponse(e.message ?: "unknown error")
        }
    }

    private fun handleResolve(): Map<String, Any?> {
        val processes = resolver.listAll()
        return mapOf(
            "type" to "result",
            "command" to "resolve",
            "success" to true,
            "data" to processes,
        )
    }

    private fun handleAttach(json: JsonObject): Map<String, Any?> {
        val pid = json.get("pid")?.asString
            ?: return errorResponse("missing pid for attach")
        val result = attachManager.attach(pid)
        return if (result.isSuccess) {
            mapOf("type" to "result", "command" to "attach", "success" to true, "data" to mapOf("pid" to pid))
        } else {
            errorResponse("attach failed: ${result.exceptionOrNull()?.message}")
        }
    }

    private fun handleSampleThreads(): Map<String, Any?> {
        val result = threadSampler.sample(attachManager)
        return mapOf(
            "type" to "result",
            "command" to "sample-threads",
            "success" to true,
            "data" to result,
        )
    }

    private fun handleSampleHeap(): Map<String, Any?> {
        val result = heapSampler.sample(attachManager)
        return mapOf(
            "type" to "result",
            "command" to "sample-heap",
            "success" to true,
            "data" to result,
        )
    }

    private fun handleScanJar(json: JsonObject): Map<String, Any?> {
        val jarPath = json.get("jarPath")?.asString
            ?: return errorResponse("missing jarPath for scan-jar")
        val result = jarScanner.scan(jarPath)
        return mapOf(
            "type" to "result",
            "command" to "scan-jar",
            "success" to true,
            "data" to result,
        )
    }

    private fun handleDetach(): Map<String, Any?> {
        val result = attachManager.detach()
        return if (result.isSuccess) {
            mapOf("type" to "result", "command" to "detach", "success" to true)
        } else {
            errorResponse("detach failed: ${result.exceptionOrNull()?.message}")
        }
    }

    private fun handleStatus(): Map<String, Any?> {
        return mapOf(
            "type" to "result",
            "command" to "status",
            "success" to true,
            "data" to mapOf(
                "state" to attachManager.state.name,
                "attachedPid" to attachManager.attachedPid,
            ),
        )
    }

    private fun handleHeapDump(json: JsonObject): Map<String, Any?> {
        val outputPath = json.get("outputPath")?.asString
            ?: return errorResponse("missing outputPath for heap-dump")
        val liveOnly = json.get("liveObjectsOnly")?.asBoolean ?: true
        
        val options = HeapDumpOptions(
            outputPath = outputPath,
            liveObjectsOnly = liveOnly
        )
        
        val result = heapDumpManager.generateHeapDump(attachManager, options)
        return mapOf(
            "type" to "result",
            "command" to "heap-dump",
            "success" to result.success,
            "data" to result,
        )
    }

    private fun handleThreadDump(json: JsonObject): Map<String, Any?> {
        val outputPath = json.get("outputPath")?.asString
            ?: return errorResponse("missing outputPath for thread-dump")
        val includeMonitors = json.get("includeLockedMonitors")?.asBoolean ?: true
        val includeSynchronizers = json.get("includeLockedSynchronizers")?.asBoolean ?: true
        
        val options = ThreadDumpOptions(
            outputPath = outputPath,
            includeLockedMonitors = includeMonitors,
            includeLockedSynchronizers = includeSynchronizers
        )
        
        val result = threadDumpManager.generateThreadDump(attachManager, options)
        return mapOf(
            "type" to "result",
            "command" to "thread-dump",
            "success" to result.success,
            "data" to result,
        )
    }

    private fun handleCheckDiskSpace(json: JsonObject): Map<String, Any?> {
        val path = json.get("path")?.asString
            ?: return errorResponse("missing path for check-disk-space")
        
        val result = heapDumpManager.checkDiskSpace(path)
        return mapOf(
            "type" to "result",
            "command" to "check-disk-space",
            "success" to true,
            "data" to result,
        )
    }

    private fun handleEstimateHeapSize(): Map<String, Any?> {
        val result = heapDumpManager.estimateHeapSize(attachManager)
        return mapOf(
            "type" to "result",
            "command" to "estimate-heap-size",
            "success" to true,
            "data" to result,
        )
    }

    private fun handleJfrStart(json: JsonObject): Map<String, Any?> {
        val name = json.get("name")?.asString ?: "jianagent-recording"
        val durationSeconds = json.get("durationSeconds")?.asInt ?: 60
        val maxSize = json.get("maxSize")?.asLong ?: 0
        val maxAge = json.get("maxAge")?.asLong ?: 0
        
        val options = JfrStartOptions(
            name = name,
            durationSeconds = durationSeconds,
            maxSize = maxSize,
            maxAge = maxAge
        )
        
        val result = jfrManager.startRecording(attachManager, options)
        return mapOf(
            "type" to "result",
            "command" to "jfr-start",
            "success" to result.success,
            "data" to result,
        )
    }

    private fun handleJfrStop(json: JsonObject): Map<String, Any?> {
        val recordingId = json.get("recordingId")?.asLong
            ?: return errorResponse("missing recordingId for jfr-stop")
        val outputPath = json.get("outputPath")?.asString
            ?: return errorResponse("missing outputPath for jfr-stop")
        
        val result = jfrManager.stopRecording(attachManager, recordingId, outputPath)
        return mapOf(
            "type" to "result",
            "command" to "jfr-stop",
            "success" to result.success,
            "data" to result,
        )
    }

    private fun handleJfrStatus(json: JsonObject): Map<String, Any?> {
        val recordingId = json.get("recordingId")?.asLong
            ?: return errorResponse("missing recordingId for jfr-status")
        
        val result = jfrManager.getRecordingStatus(attachManager, recordingId)
        return mapOf(
            "type" to "result",
            "command" to "jfr-status",
            "success" to (result != null),
            "data" to result,
        )
    }

    private fun handleJvmFlags(): Map<String, Any?> {
        val result = jvmInfoManager.getJvmFlags(attachManager)
        return mapOf(
            "type" to "result",
            "command" to "jvm-flags",
            "success" to true,
            "data" to result,
        )
    }

    private fun handleClassLoading(): Map<String, Any?> {
        val result = jvmInfoManager.getClassLoadingInfo(attachManager)
        return mapOf(
            "type" to "result",
            "command" to "class-loading",
            "success" to true,
            "data" to result,
        )
    }

    private fun handleGcInfo(): Map<String, Any?> {
        val result = jvmInfoManager.getGcInfo(attachManager)
        return mapOf(
            "type" to "result",
            "command" to "gc-info",
            "success" to true,
            "data" to result,
        )
    }

    private fun handleCpuSampling(json: JsonObject): Map<String, Any?> {
        val durationSeconds = json.get("durationSeconds")?.asInt ?: 10
        val intervalMs = json.get("intervalMs")?.asLong ?: 100L
        
        val result = cpuSamplingManager.startSampling(attachManager, durationSeconds, intervalMs)
        return mapOf(
            "type" to "result",
            "command" to "cpu-sampling",
            "success" to result.success,
            "data" to result,
        )
    }

    private fun handleShutdown(json: JsonObject): Map<String, Any?> {
        val graceful = json.get("graceful")?.asBoolean ?: true
        val timeoutSeconds = json.get("timeout")?.asInt ?: 30
        
        val result = shutdownManager.shutdown(attachManager, graceful, timeoutSeconds)
        return mapOf(
            "type" to "result",
            "command" to "shutdown",
            "success" to result.success,
            "data" to result,
        )
    }

    private fun handleStartMonitoring(json: JsonObject): Map<String, Any?> {
        val intervalSeconds = json.get("interval")?.asInt ?: 5
        
        val result = monitoringManager.startMonitoring(attachManager, intervalSeconds)
        return mapOf(
            "type" to "result",
            "command" to "start-monitoring",
            "success" to result.success,
            "data" to result,
        )
    }

    private fun handleStopMonitoring(): Map<String, Any?> {
        val result = monitoringManager.stopMonitoring()
        return mapOf(
            "type" to "result",
            "command" to "stop-monitoring",
            "success" to result.success,
            "data" to result,
        )
    }

    private fun handleMonitoringStatus(): Map<String, Any?> {
        val isRunning = monitoringManager.isMonitoring()
        return mapOf(
            "type" to "result",
            "command" to "monitoring-status",
            "success" to true,
            "data" to mapOf("isRunning" to isRunning),
        )
    }

    private fun errorResponse(message: String): Map<String, Any?> =
        mapOf("type" to "error", "success" to false, "message" to message)
}
