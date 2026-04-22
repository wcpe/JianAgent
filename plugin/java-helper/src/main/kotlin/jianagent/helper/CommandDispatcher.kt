package jianagent.helper

import com.google.gson.Gson
import com.google.gson.JsonObject
import jianagent.helper.resolve.JvmResolver
import jianagent.helper.attach.AttachManager
import jianagent.helper.sampling.ThreadSampler
import jianagent.helper.sampling.HeapSampler
import jianagent.helper.scan.JarScanner

class CommandDispatcher(private val gson: Gson) {
    private val resolver = JvmResolver()
    private val attachManager = AttachManager()
    private val threadSampler = ThreadSampler()
    private val heapSampler = HeapSampler()
    private val jarScanner = JarScanner()

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
                "detach" -> handleDetach()
                "status" -> handleStatus()
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

    private fun errorResponse(message: String): Map<String, Any?> =
        mapOf("type" to "error", "success" to false, "message" to message)
}
