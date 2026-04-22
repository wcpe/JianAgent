package jianagent.probe.action

import java.util.logging.Logger

/**
 * Dispatches incoming action requests to the appropriate [WhitelistAction].
 * Validates parameters against the action's declared schema before execution.
 */
object ActionDispatcher {
    private val logger: Logger = Logger.getLogger("JianAgent-ActionDispatcher")

    fun dispatch(actionName: String, params: Map<String, Any>): ActionResult {
        val action = ActionRegistry.get(actionName)
            ?: return ActionResult(false, "Unknown action: $actionName")

        val validationError = validateParams(action, params)
        if (validationError != null) {
            return ActionResult(false, validationError)
        }

        return try {
            action.execute(params)
        } catch (e: Exception) {
            logger.warning("Action '$actionName' threw exception: ${e.message}")
            ActionResult(false, "Action failed: ${e.message}")
        }
    }

    private fun validateParams(action: WhitelistAction, params: Map<String, Any>): String? {
        for ((key, type) in action.paramSchema) {
            val value = params[key]
            if (value == null) {
                // allow optional params
                continue
            }
            val valid = when (type) {
                ParamType.STRING, ParamType.PLAYER_NAME, ParamType.LOCATION -> value is String
                ParamType.INT -> value is Int || value is Long || (value is Number && value.toDouble() == value.toLong().toDouble())
                ParamType.DOUBLE -> value is Number
                ParamType.BOOLEAN -> value is Boolean
            }
            if (!valid) {
                return "Parameter '$key' expected type $type but got ${value::class.simpleName}"
            }
        }
        return null
    }
}
