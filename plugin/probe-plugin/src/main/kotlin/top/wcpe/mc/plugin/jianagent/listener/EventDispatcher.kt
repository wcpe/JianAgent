package top.wcpe.mc.plugin.jianagent.listener

import top.wcpe.mc.plugin.jianagent.ProbePlugin
import top.wcpe.mc.plugin.jianagent.api.ProbeEvent
import java.time.Instant

object EventDispatcher {

    fun dispatch(eventType: String, data: Map<String, Any?>) {
        val bridge = ProbePlugin.bridgeOrNull ?: return
        if (!bridge.status.isReady()) return
        val event = ProbeEvent(
            eventType = eventType,
            data = data,
            timestamp = Instant.now().toString(),
        )
        bridge.send("plugin:event", event)
    }
}
