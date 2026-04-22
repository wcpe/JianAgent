package top.wcpe.mc.plugin.jianagent.script

import org.bukkit.Bukkit
import java.io.StringWriter
import java.util.logging.Logger
import javax.script.ScriptContext
import javax.script.ScriptEngineManager
import javax.script.SimpleScriptContext

/**
 * JavaScript scripting engine for probe debugging.
 * Uses javax.script (GraalJS on GraalVM, or Nashorn fallback).
 * Scripts have access to: server, Bukkit, logger.
 */
class ScriptEngine(private val logger: Logger) {

    private val engineManager = ScriptEngineManager()

    /**
     * Evaluate a JavaScript expression/block and return the result as a string.
     * Executed on the server main thread (caller must ensure this).
     */
    fun eval(script: String): String? {
        val engine = engineManager.getEngineByName("js")
            ?: engineManager.getEngineByName("graal.js")
            ?: engineManager.getEngineByName("nashorn")
            ?: throw UnsupportedOperationException(
                "No JS engine available. Ensure GraalVM is used or add GraalJS dependency."
            )

        val writer = StringWriter()
        val context = SimpleScriptContext().apply {
            this.writer = writer
            this.errorWriter = writer
        }

        // Bind useful Bukkit objects into the script scope
        val bindings = engine.createBindings()
        bindings["server"] = Bukkit.getServer()
        bindings["Bukkit"] = Bukkit::class.java
        bindings["logger"] = logger
        bindings["onlinePlayers"] = Bukkit.getOnlinePlayers()
        bindings["worlds"] = Bukkit.getWorlds()
        context.setBindings(bindings, ScriptContext.ENGINE_SCOPE)

        val result = engine.eval(script, context)
        val output = writer.toString()

        return when {
            output.isNotBlank() && result != null -> "$output\n→ $result"
            output.isNotBlank() -> output.trimEnd()
            result != null -> result.toString()
            else -> null
        }
    }
}
