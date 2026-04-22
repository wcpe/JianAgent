package jianagent.probe.action

/**
 * Whitelist action interface — each registered action can be invoked
 * remotely from the JianAgent server via the plugin bridge.
 */
interface WhitelistAction {
    /** Unique, lowercase action name used in protocol messages. */
    val name: String

    /** Schema describing expected parameters. */
    val paramSchema: Map<String, ParamType>

    /** Execute the action with validated parameters. */
    fun execute(params: Map<String, Any>): ActionResult
}

data class ActionResult(
    val success: Boolean,
    val message: String,
    val data: Map<String, Any>? = null,
)

enum class ParamType {
    STRING,
    INT,
    DOUBLE,
    BOOLEAN,
    PLAYER_NAME,
    LOCATION,
}
