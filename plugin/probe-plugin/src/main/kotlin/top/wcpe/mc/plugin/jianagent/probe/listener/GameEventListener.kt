package jianagent.probe.listener

import jianagent.probe.action.impl.GameForceStartEvent
import jianagent.probe.action.impl.GameStopEvent
import taboolib.common.platform.event.SubscribeEvent
import top.wcpe.mc.plugin.jianagent.ProbePlugin

/**
 * Listens for custom game lifecycle events (force start / stop) and reports
 * them to the JianAgent server for session-level tracking.
 */
object GameEventListener {

    @SubscribeEvent
    fun onGameForceStart(event: GameForceStartEvent) {
        val bridge = ProbePlugin.bridgeOrNull ?: return
        bridge.send("game_force_start", mapOf(
            "timestamp" to System.currentTimeMillis(),
        ))
    }

    @SubscribeEvent
    fun onGameStop(event: GameStopEvent) {
        val bridge = ProbePlugin.bridgeOrNull ?: return
        bridge.send("game_stop", mapOf(
            "timestamp" to System.currentTimeMillis(),
        ))
    }
}
