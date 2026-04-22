package top.wcpe.mc.plugin.jianagent.command

import top.wcpe.mc.plugin.jianagent.api.ProbeCommand
import top.wcpe.mc.plugin.jianagent.api.ProbeCommandResult
import top.wcpe.mc.plugin.jianagent.command.actions.*
import java.util.logging.Logger

class CommandProxy(
    private val logger: Logger = Logger.getLogger("JianAgent"),
) {
    private val actions: Map<String, Action> = listOf(
        TeleportAction(),
        ForceStartAction(),
        StopGameAction(),
        SnapshotAction(),
    ).associateBy { it.actionId }

    fun execute(command: ProbeCommand): ProbeCommandResult {
        if (!WhitelistActions.isAllowed(command.action)) {
            logger.warning("[JianAgent] Rejected non-whitelisted action: ${command.action}")
            return ProbeCommandResult(
                requestId = command.requestId,
                success = false,
                message = "Action '${command.action}' is not whitelisted",
            )
        }

        val action = actions[command.action]
            ?: return ProbeCommandResult(
                requestId = command.requestId,
                success = false,
                message = "Action '${command.action}' is whitelisted but not implemented",
            )

        return try {
            action.execute(command.params, command.requestId)
        } catch (e: Exception) {
            logger.warning("[JianAgent] Action ${command.action} failed: ${e.message}")
            ProbeCommandResult(
                requestId = command.requestId,
                success = false,
                message = "Action failed: ${e.message}",
            )
        }
    }
}
