package top.wcpe.mc.plugin.jianagent.bridge

import com.google.gson.JsonElement
import org.bukkit.Bukkit
import top.wcpe.mc.plugin.jianagent.api.ProbeSnapshot
import top.wcpe.mc.plugin.jianagent.api.ProbeCommand
import top.wcpe.mc.plugin.jianagent.api.ProbeCommandResult
import top.wcpe.mc.plugin.jianagent.command.CommandProxy
import top.wcpe.mc.plugin.jianagent.runtime.ProbeMessageRouter
import top.wcpe.mc.plugin.jianagent.snapshot.ServerSnapshot
import top.wcpe.mc.plugin.jianagent.script.ScriptEngine
import java.util.logging.Logger

class MessageRouter(
    private val bridge: ProbeBridgeClient,
    private val commandProxy: CommandProxy = CommandProxy(),
    private val snapshotProvider: () -> ProbeSnapshot = ServerSnapshot::collect,
    private val mainThreadDispatcher: ((() -> Unit) -> Unit) = { action -> action() },
    private val logger: Logger = Logger.getLogger("JianAgent"),
    private val scriptEngine: ScriptEngine = ScriptEngine(logger),
) : ProbeMessageRouter {
    override fun route(channel: String, payload: JsonElement) {
        try {
            mainThreadDispatcher {
                try {
                    when (channel) {
                        "server:command" -> handleCommand(payload)
                        "server:snapshot-request" -> handleSnapshotRequest()
                        "server:execute-console" -> handleConsoleCommand(payload)
                        "server:eval-script" -> handleEvalScript(payload)
                        else -> logger.fine("[JianAgent] Unknown channel: $channel")
                    }
                } catch (e: Exception) {
                    logger.warning("[JianAgent] Failed to route message: ${e.message}")
                }
            }
        } catch (e: Exception) {
            logger.warning("[JianAgent] Failed to schedule message routing: ${e.message}")
        }
    }

    private fun handleCommand(payload: JsonElement) {
        if (!payload.isJsonObject) {
            return
        }

        val payloadObject = payload.asJsonObject
        val action = payloadObject.get("action")?.asString ?: return
        val requestId = payloadObject.get("requestId")?.asString ?: return
        val paramsMap = mutableMapOf<String, Any?>()
        payloadObject.get("params")?.takeIf { it.isJsonObject }?.asJsonObject?.entrySet()?.forEach { entry ->
            val key = entry.key
            val value = entry.value
            paramsMap[key] = when {
                value.isJsonNull -> null
                value.isJsonPrimitive && value.asJsonPrimitive.isNumber -> value.asNumber
                value.isJsonPrimitive && value.asJsonPrimitive.isBoolean -> value.asBoolean
                else -> value.asString
            }
        }

        val command = ProbeCommand(action = action, params = paramsMap, requestId = requestId)
        val result = commandProxy.execute(command)
        bridge.send("plugin:command-result", result)
    }

    private fun handleConsoleCommand(payload: JsonElement) {
        if (!payload.isJsonObject) return
        val obj = payload.asJsonObject
        val command = obj.get("command")?.asString ?: return
        val requestId = obj.get("requestId")?.asString ?: "unknown"

        try {
            val success = Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command)
            bridge.send("plugin:console-result", ProbeCommandResult(
                requestId = requestId,
                success = success,
                message = if (success) "Command dispatched: $command" else "Command failed: $command",
            ))
        } catch (e: Exception) {
            bridge.send("plugin:console-result", ProbeCommandResult(
                requestId = requestId,
                success = false,
                message = "Console command error: ${e.message}",
            ))
        }
    }

    private fun handleEvalScript(payload: JsonElement) {
        if (!payload.isJsonObject) return
        val obj = payload.asJsonObject
        val script = obj.get("script")?.asString ?: return
        val requestId = obj.get("requestId")?.asString ?: "unknown"

        try {
            val result = scriptEngine.eval(script)
            bridge.send("plugin:eval-result", ProbeCommandResult(
                requestId = requestId,
                success = true,
                message = result ?: "null",
            ))
        } catch (e: Exception) {
            bridge.send("plugin:eval-result", ProbeCommandResult(
                requestId = requestId,
                success = false,
                message = "Script error: ${e.message}",
            ))
        }
    }

    private fun handleSnapshotRequest() {
        try {
            bridge.send("plugin:snapshot", snapshotProvider())
        } catch (e: Exception) {
            logger.warning("[JianAgent] Snapshot request failed: ${e.message}")
        }
    }
}
