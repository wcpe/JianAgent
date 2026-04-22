package jianagent.probe.action.impl

import jianagent.probe.action.ActionResult
import jianagent.probe.action.ParamType
import jianagent.probe.action.WhitelistAction
import org.bukkit.Bukkit
import org.bukkit.event.Event
import org.bukkit.event.HandlerList

/**
 * Custom event fired when the server force-starts a game session.
 */
class GameForceStartEvent : Event() {
    companion object {
        @JvmStatic
        val handlerList = HandlerList()
    }
    override fun getHandlers(): HandlerList = handlerList
}

class ForceStartAction : WhitelistAction {
    override val name = "force_start"

    override val paramSchema: Map<String, ParamType> = emptyMap()

    override fun execute(params: Map<String, Any>): ActionResult {
        Bukkit.getPluginManager().callEvent(GameForceStartEvent())
        return ActionResult(true, "GameForceStartEvent fired")
    }
}
