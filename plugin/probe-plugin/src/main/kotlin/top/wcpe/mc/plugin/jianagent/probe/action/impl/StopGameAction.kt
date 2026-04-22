package jianagent.probe.action.impl

import jianagent.probe.action.ActionResult
import jianagent.probe.action.ParamType
import jianagent.probe.action.WhitelistAction
import org.bukkit.Bukkit
import org.bukkit.event.Event
import org.bukkit.event.HandlerList

/**
 * Custom event fired when the server stops a running game session.
 */
class GameStopEvent : Event() {
    companion object {
        @JvmStatic
        val handlerList = HandlerList()
    }
    override fun getHandlers(): HandlerList = handlerList
}

class StopGameAction : WhitelistAction {
    override val name = "stop_game"

    override val paramSchema: Map<String, ParamType> = emptyMap()

    override fun execute(params: Map<String, Any>): ActionResult {
        Bukkit.getPluginManager().callEvent(GameStopEvent())
        return ActionResult(true, "GameStopEvent fired")
    }
}
